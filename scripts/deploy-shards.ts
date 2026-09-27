#!/usr/bin/env bun
/**
 * Deploy dist/ across several Workers, one shard at a time.
 *
 *   bun scripts/deploy-shards.ts          plan, then deploy every shard + root
 *   bun scripts/deploy-shards.ts --plan   print the shard plan and stop
 *
 * Why this exists: Workers static assets cap out at 100,000 files per Worker
 * version (wrangler's MAX_ASSET_COUNT), and dist/ passed that. The split unit
 * is a top-level dist/ folder — folders are packed into `digest-law-shard-a`,
 * `-b`, … each kept under SHARD_BUDGET, and the root `digest-law` Worker keeps
 * the custom domain, the root-level files, /api/* and /id/*, and forwards
 * shard folders over service bindings (see SHARD_MAP in worker/index.ts).
 *
 * Everything stays in this repo and in ./dist: each deploy step rewrites
 * dist/.assetsignore so wrangler's manifest sees only that shard's folders
 * (the whitelist pattern is verified against wrangler's `ignore` engine:
 * `/*` + `!/404.html` + `!/<folder>/`), then runs `wrangler deploy -c` with a
 * config generated into .wrangler-shards/. Shards deploy before root so the
 * service bindings root declares always exist; the live site cuts over only
 * when root deploys, because until then the old root still serves everything.
 *
 * Folder→shard assignments persist in scripts/shard-assignments.json (commit
 * it). Sticky assignments matter: a folder that moves shards is briefly 404
 * between its old shard's redeploy and the root redeploy, so the packer only
 * moves folders when a shard outgrows its budget.
 *
 * Workers assets also cap each file at 25 MiB. A root-level file past that
 * (skos.jsonld, the whole concept graph) is split into `<name>.part-NNN`
 * siblings before the root deploy, the original is kept out of the root
 * manifest, and the root Worker streams the parts back as one response (see
 * OVERSIZE_ASSETS in worker/index.ts). Every file's size is checked before
 * anything deploys, so an oversized file can no longer fail the run midway;
 * the same preflight (auth, sizes, counts, bindings, wrangler dry-runs) runs
 * before every deploy and with --plan.
 *
 *   bun scripts/deploy-shards.ts --only=root        redeploy just the root
 *   bun scripts/deploy-shards.ts --only=a,c,root    or any subset
 *
 * Deliberately NOT handled: a single top-level folder larger than the 100k
 * cap, or an oversized file inside a folder (shards have no Worker to
 * reassemble it). Both need a human decision — this script refuses loudly.
 */

import type { Dirent } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, ".."),
  DIST = path.join(ROOT, "dist"),
  OUT_DIR = path.join(ROOT, ".wrangler-shards"),
  ASSIGNMENTS_PATH = path.resolve(
    import.meta.dirname,
    "shard-assignments.json"
  ),
  BASE_CONFIG_PATH = path.join(ROOT, "wrangler.jsonc"),
  WRANGLER_BIN = path.join(ROOT, "node_modules/.bin/wrangler"),
  IGNORE_PATH = path.join(DIST, ".assetsignore"),
  SHARD_SERVICE_PREFIX = "digest-law-shard-",
  /** Hard platform cap on assets per Worker version. */
  MAX_ASSETS = 100_000,
  /** Soft cap per shard, leaving growth room before anything must move. */
  BUDGET = Number(process.env.SHARD_BUDGET ?? 80_000),
  /** Hard platform cap on a single asset's size. */
  MAX_ASSET_BYTES = 25 * 1024 * 1024,
  /** Part size for splitting oversized root files, safely under the cap. */
  PART_BYTES = 20 * 1024 * 1024,
  PART_SUFFIX = ".part-",
  /** wrangler rejects run_worker_first arrays longer than this. */
  MAX_RUN_WORKER_FIRST_RULES = 100,
  planOnly = process.argv.includes("--plan"),
  /** `--only=root` or `--only=a,c,root`: deploy just these; absent = all. */
  only = process.argv
    .find((arg) => arg.startsWith("--only="))
    ?.slice("--only=".length)
    .split(",")
    .filter(Boolean);

// ---------------------------------------------------------------------------
// JSONC — wrangler.jsonc is the single source of truth for the root Worker,
// so the generated configs inherit from it rather than duplicating it.
// ---------------------------------------------------------------------------

/** Strip // and slash-star comments, then trailing commas — string-aware. */
function parseJsonc(text: string): Record<string, unknown> {
  let i = 0,
    inString = false,
    out = "";
  while (i < text.length) {
    const ch = text[i],
      next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      i += 1;
    } else if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") {
        i += 1;
      }
    } else if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
    } else {
      out += ch;
      i += 1;
    }
  }
  // Trailing commas: a `,` whose next meaningful character closes a scope.
  let clean = "";
  inString = false;
  for (let j = 0; j < out.length; j += 1) {
    const ch = out[j];
    if (inString) {
      clean += ch;
      if (ch === "\\") {
        clean += out[j + 1] ?? "";
        j += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      clean += ch;
      continue;
    }
    if (ch === ",") {
      let k = j + 1;
      while (k < out.length && /\s/u.test(out[k] ?? "")) {
        k += 1;
      }
      if (out[k] === "}" || out[k] === "]") {
        continue;
      }
    }
    clean += ch;
  }
  return JSON.parse(clean) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

interface Folder {
  files: number;
  name: string;
}

interface Inventory {
  folders: Folder[];
  /** Root-level files past MAX_ASSET_BYTES (never parts, never the ignore file). */
  oversizeRoot: { name: string; size: number }[];
  rootFiles: number;
}

const isPart = (name: string) => /\.part-\d{3}$/u.test(name);

async function inventory(): Promise<Inventory> {
  let entries: Dirent[];
  try {
    entries = await readdir(DIST, { withFileTypes: true });
  } catch {
    throw new Error(`No ${DIST} — run the build first.`);
  }
  const folders: Folder[] = [],
    oversizeRoot: Inventory["oversizeRoot"] = [],
    oversizeNested: string[] = [];
  let rootFiles = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const all = await readdir(path.join(DIST, entry.name), {
          recursive: true,
          withFileTypes: true,
        }),
        nested = all.filter((n) => n.isFile());
      for (const file of nested) {
        const full = path.join(file.parentPath, file.name),
          { size } = await stat(full);
        if (size > MAX_ASSET_BYTES) {
          oversizeNested.push(path.relative(DIST, full));
        }
      }
      folders.push({ files: nested.length, name: entry.name });
    } else if (entry.name !== ".assetsignore" && !isPart(entry.name)) {
      rootFiles += 1;
      const { size } = await stat(path.join(DIST, entry.name));
      if (size > MAX_ASSET_BYTES) {
        oversizeRoot.push({ name: entry.name, size });
      }
    }
  }
  if (oversizeNested.length > 0) {
    throw new Error(
      `Files over the ${MAX_ASSET_BYTES / 1024 / 1024} MiB asset cap inside sharded folders: ${oversizeNested.join(", ")}. ` +
        "Shards have no Worker to reassemble split files — that is a human decision."
    );
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, oversizeRoot, rootFiles };
}

// ---------------------------------------------------------------------------
// Oversized root files — split into parts the root Worker reassembles
// ---------------------------------------------------------------------------

/** Mirrors worker/index.ts's OversizeAsset. */
interface OversizeAsset {
  contentType: string;
  /** Strong validator: sha256 of the whole file. */
  etag: string;
  parts: string[];
  size: number;
}

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".jsonld": "application/ld+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

/**
 * Rewrite every `<name>.part-NNN` at the dist root from scratch: stale parts
 * of a file that shrank or vanished are removed, oversized files re-split.
 * Returns the URL-path → parts map the root Worker receives as a var.
 */
async function splitOversize(
  oversize: Inventory["oversizeRoot"]
): Promise<Record<string, OversizeAsset>> {
  for (const name of await readdir(DIST)) {
    if (isPart(name)) {
      await rm(path.join(DIST, name));
    }
  }
  const map: Record<string, OversizeAsset> = {};
  for (const { name, size } of oversize) {
    const bytes = await readFile(path.join(DIST, name)),
      parts: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += PART_BYTES) {
      const part = `${name}${PART_SUFFIX}${String(parts.length).padStart(3, "0")}`;
      await writeFile(
        path.join(DIST, part),
        bytes.subarray(offset, offset + PART_BYTES)
      );
      parts.push(`/${part}`);
    }
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(bytes);
    map[`/${name}`] = {
      contentType:
        CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream",
      etag: `"${hasher.digest("hex")}"`,
      parts,
      size,
    };
  }
  return map;
}

// ---------------------------------------------------------------------------
// Packing — sticky first, first-fit-decreasing for whatever is new or evicted
// ---------------------------------------------------------------------------

type Assignments = Record<string, string>; // folder → shard letter

function shardLetter(index: number): string {
  // a…z, then aa, ab, … — nobody should ever see three letters.
  let n = index,
    name = "";
  do {
    name = String.fromCodePoint(97 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

async function loadAssignments(): Promise<Assignments> {
  try {
    return JSON.parse(await readFile(ASSIGNMENTS_PATH, "utf8")) as Assignments;
  } catch {
    return {};
  }
}

interface Shard {
  files: number;
  folders: Folder[];
  letter: string;
}

function pack(folders: Folder[], previous: Assignments): Shard[] {
  const byName = new Map(folders.map((f) => [f.name, f])),
    shards = new Map<string, Shard>(),
    shardOf = (letter: string): Shard => {
      let shard = shards.get(letter);
      if (!shard) {
        shard = { files: 0, folders: [], letter };
        shards.set(letter, shard);
      }
      return shard;
    },
    // Keep prior placements for folders that still exist.
    unplaced: Folder[] = [];
  for (const folder of folders) {
    const letter = previous[folder.name];
    if (letter) {
      const shard = shardOf(letter);
      shard.folders.push(folder);
      shard.files += folder.files;
    } else {
      unplaced.push(folder);
    }
  }

  // A shard that outgrew its budget sheds its smallest folders — smallest
  // first, because each move costs a brief 404 window for that folder.
  for (const shard of shards.values()) {
    const oversized = () => shard.files > BUDGET && shard.folders.length > 1;
    shard.folders.sort((a, b) => b.files - a.files);
    while (oversized()) {
      const evicted = shard.folders.pop();
      if (!evicted) {
        break;
      }
      shard.files -= evicted.files;
      unplaced.push(evicted);
    }
  }

  // First-fit-decreasing into existing shards, new shards as needed.
  unplaced.sort((a, b) => b.files - a.files || a.name.localeCompare(b.name));
  const letters = () => [...shards.keys()].toSorted();
  for (const folder of unplaced) {
    const home = letters()
      .map((letter) => shardOf(letter))
      .find((shard) => shard.files + folder.files <= BUDGET);
    if (home) {
      home.folders.push(folder);
      home.files += folder.files;
      continue;
    }
    let index = 0;
    while (shards.has(shardLetter(index))) {
      index += 1;
    }
    const fresh = shardOf(shardLetter(index));
    fresh.folders.push(folder);
    fresh.files += folder.files;
  }

  const packed = [...shards.values()]
    .filter((shard) => shard.folders.length > 0)
    .toSorted((a, b) => a.letter.localeCompare(b.letter));
  for (const shard of packed) {
    shard.folders.sort((a, b) => a.name.localeCompare(b.name));
    const total = shard.files + 1; // +1: every shard also carries /404.html
    if (total > MAX_ASSETS) {
      const detail = shard.folders.map((f) => `${f.name} (${f.files})`);
      throw new Error(
        `Shard ${shard.letter} would hold ${total} files, over the ${MAX_ASSETS} cap: ${detail.join(", ")}. ` +
          "A single folder past the cap needs splitting one level deeper — that is a human decision."
      );
    }
  }
  // Sanity: every folder placed exactly once.
  const placed = packed.flatMap((s) => s.folders.map((f) => f.name));
  if (placed.length !== byName.size) {
    throw new Error(
      "Packing lost or duplicated a folder — refusing to deploy."
    );
  }
  return packed;
}

// ---------------------------------------------------------------------------
// Config + ignore-file generation
// ---------------------------------------------------------------------------

function bindingNameOf(letter: string): string {
  return `SHARD_${letter.toUpperCase()}`;
}

function serviceNameOf(letter: string): string {
  return `${SHARD_SERVICE_PREFIX}${letter}`;
}

/** Manifest whitelist for one shard: its folders plus the 404 page. */
function shardIgnoreFile(shard: Shard): string {
  const lines = ["/*", "!/404.html"];
  for (const folder of shard.folders) {
    lines.push(`!/${folder.name}/`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Root keeps only root-level files: every sharded folder is excluded, and so
 * is every oversized original (its parts ship in its place).
 */
function rootIgnoreFile(
  shards: Shard[],
  oversize: Record<string, OversizeAsset>
): string {
  const lines = [
    ...shards.flatMap((shard) =>
      shard.folders.map((folder) => `/${folder.name}/`)
    ),
    ...Object.keys(oversize),
  ];
  return `${lines.toSorted().join("\n")}\n`;
}

/**
 * One `/{folder}*` rule per sharded folder. Trailing `*` is a cross-segment
 * prefix match, so a rule that another folder's name extends (criminal-law vs
 * criminal-law-public-order-…) covers both — and wrangler hard-errors on the
 * redundant longer rule, so it must be dropped here. Over-matching is safe:
 * the Worker routes by exact first segment and falls back to its own assets.
 */
function runWorkerFirstRules(
  base: string[],
  shards: Shard[],
  oversizePaths: string[]
): string[] {
  const folderRules = shards
      .flatMap((shard) => shard.folders.map((folder) => `/${folder.name}*`))
      .toSorted(),
    rules = [...base, ...oversizePaths.toSorted()];
  for (const rule of folderRules) {
    const prefix = rule.slice(0, -1),
      covered = rules.some(
        (kept) => kept.endsWith("*") && prefix.startsWith(kept.slice(0, -1))
      );
    if (!covered) {
      rules.push(rule);
    }
  }
  if (rules.length > MAX_RUN_WORKER_FIRST_RULES) {
    throw new Error(
      `${rules.length} run_worker_first rules exceed wrangler's cap of ${MAX_RUN_WORKER_FIRST_RULES}. ` +
        'Switch the generated root config to `"run_worker_first": true` instead.'
    );
  }
  return rules;
}

interface GeneratedConfigs {
  rootConfigPath: string;
  rootIgnore: string;
  shardConfigPathOf: (shard: Shard) => string;
  shardIgnoreOf: (shard: Shard) => string;
}

async function generateConfigs(
  shards: Shard[],
  oversize: Record<string, OversizeAsset>
): Promise<GeneratedConfigs> {
  const base = parseJsonc(await readFile(BASE_CONFIG_PATH, "utf8")),
    baseAssets = base.assets as Record<string, unknown>,
    baseRules = (baseAssets.run_worker_first as string[] | undefined) ?? [];

  await rm(OUT_DIR, { force: true, recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  for (const shard of shards) {
    const config = {
      assets: {
        directory: "../dist",
        not_found_handling: "404-page",
      },
      compatibility_date: base.compatibility_date,
      name: serviceNameOf(shard.letter),
      observability: base.observability,
      preview_urls: false,
      workers_dev: false,
    };
    await writeFile(
      path.join(OUT_DIR, `shard-${shard.letter}.json`),
      `${JSON.stringify(config, null, 2)}\n`
    );
  }

  const shardMap: Record<string, string> = {};
  for (const shard of shards) {
    for (const folder of shard.folders) {
      shardMap[folder.name] = bindingNameOf(shard.letter);
    }
  }
  const rootConfig = {
      ...base,
      $schema: undefined,
      assets: {
        ...baseAssets,
        directory: "../dist",
        run_worker_first: runWorkerFirstRules(
          baseRules,
          shards,
          Object.keys(oversize)
        ),
      },
      main: "../worker/index.ts",
      services: shards.map((shard) => ({
        binding: bindingNameOf(shard.letter),
        service: serviceNameOf(shard.letter),
      })),
      vars: {
        ...(base.vars as Record<string, unknown> | undefined),
        OVERSIZE_ASSETS: oversize,
        SHARD_MAP: shardMap,
      },
    },
    rootConfigPath = path.join(OUT_DIR, "root.json");
  await writeFile(rootConfigPath, `${JSON.stringify(rootConfig, null, 2)}\n`);

  return {
    rootConfigPath,
    rootIgnore: rootIgnoreFile(shards, oversize),
    shardConfigPathOf: (shard) =>
      path.join(OUT_DIR, `shard-${shard.letter}.json`),
    shardIgnoreOf: shardIgnoreFile,
  };
}

// ---------------------------------------------------------------------------
// Preflight — everything that could fail a deploy midway, checked up front
// ---------------------------------------------------------------------------

function wrangler(args: string[]): { ok: boolean; output: string } {
  const result = Bun.spawnSync([WRANGLER_BIN, ...args], {
    cwd: ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    ok: result.exitCode === 0,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
}

async function sha256(file: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await readFile(file));
  return hasher.digest("hex");
}

/**
 * Throws with every problem found, before a single Worker deploys. The asset
 * checks mirror what wrangler enforces while building its manifest — which
 * `wrangler deploy --dry-run` skips, so the dry-runs below cover only
 * config and bundle errors.
 */
async function preflight(
  shards: Shard[],
  oversize: Record<string, OversizeAsset>,
  configs: GeneratedConfigs
): Promise<void> {
  const problems: string[] = [],
    check = (label: string, ok: boolean, detail = "") => {
      console.log(
        `  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`
      );
      if (!ok) {
        problems.push(`${label}${detail ? `: ${detail}` : ""}`);
      }
    };
  console.log("preflight:");

  const whoami = wrangler(["whoami"]);
  check(
    "wrangler is authenticated",
    whoami.ok && !/not authenticated/iu.test(whoami.output)
  );

  // Root manifest: every root-level file that ships, parts included.
  const excluded = new Set(Object.keys(oversize).map((p) => p.slice(1))),
    rootEntries = await readdir(DIST, { withFileTypes: true }),
    shipped = rootEntries.filter(
      (e) => e.isFile() && e.name !== ".assetsignore" && !excluded.has(e.name)
    ),
    tooBig: string[] = [];
  for (const entry of shipped) {
    const { size } = await stat(path.join(DIST, entry.name));
    if (size > MAX_ASSET_BYTES) {
      tooBig.push(entry.name);
    }
  }
  check(
    `root files ≤ ${MAX_ASSET_BYTES / 1024 / 1024} MiB each`,
    tooBig.length === 0,
    tooBig.join(", ")
  );
  check(
    `root ≤ ${MAX_ASSETS} files`,
    shipped.length <= MAX_ASSETS,
    `${shipped.length}`
  );

  for (const [urlPath, asset] of Object.entries(oversize)) {
    const joined = new Bun.CryptoHasher("sha256");
    for (const part of asset.parts) {
      joined.update(await readFile(path.join(DIST, part)));
    }
    check(
      `${urlPath} parts reassemble byte-identical`,
      joined.digest("hex") === (await sha256(path.join(DIST, urlPath)))
    );
  }

  // Root config and the shards it binds to must agree.
  const rootConfig = JSON.parse(
      await readFile(configs.rootConfigPath, "utf8")
    ) as {
      services: { binding: string }[];
      vars: { SHARD_MAP: Record<string, string> };
    },
    bindings = new Set(rootConfig.services.map((s) => s.binding)),
    dangling = Object.entries(rootConfig.vars.SHARD_MAP).filter(
      ([, binding]) => !bindings.has(binding)
    );
  check(
    "every SHARD_MAP folder has a service binding",
    dangling.length === 0,
    dangling.map(([folder]) => folder).join(", ")
  );

  // Config + bundle validation, no upload. `--dry-run` still walks and
  // hashes the assets directory (15 min over the full dist/), so each config
  // is copied pointing at an empty one — the asset checks above cover dist.
  // Shard configs are identical in shape; one stands in for all of them.
  const emptyAssets = path.join(OUT_DIR, "preflight-empty-assets"),
    targets = [configs.rootConfigPath];
  await mkdir(emptyAssets, { recursive: true });
  if (shards[0]) {
    targets.push(configs.shardConfigPathOf(shards[0]));
  }
  for (const target of targets) {
    const config = JSON.parse(await readFile(target, "utf8")) as {
        assets: Record<string, unknown>;
      },
      probe = path.join(OUT_DIR, `preflight-${path.basename(target)}`);
    config.assets.directory = "./preflight-empty-assets";
    await writeFile(probe, JSON.stringify(config));
    const dry = wrangler(["deploy", "--dry-run", "-c", probe]);
    await rm(probe, { force: true });
    check(
      `wrangler dry-run ${path.basename(target)}`,
      dry.ok,
      dry.ok ? "" : dry.output.trim().split("\n").slice(-5).join(" | ")
    );
  }
  await rm(emptyAssets, { force: true, recursive: true });

  if (problems.length > 0) {
    throw new Error(
      `Preflight failed — nothing was deployed:\n  ${problems.join("\n  ")}`
    );
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

function deploy(configPath: string): void {
  const result = Bun.spawnSync([WRANGLER_BIN, "deploy", "-c", configPath], {
    cwd: ROOT,
    stderr: "inherit",
    stdout: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `wrangler deploy failed for ${path.relative(ROOT, configPath)} — nothing after it was deployed; rerun once fixed.`
    );
  }
}

const { folders, oversizeRoot, rootFiles } = await inventory(),
  previous = await loadAssignments(),
  shards = pack(folders, previous),
  assignments: Assignments = {};
for (const shard of shards) {
  for (const folder of shard.folders) {
    assignments[folder.name] = shard.letter;
  }
}
// A partial deploy is only safe when no folder changed shard: root's
// SHARD_MAP would otherwise route a folder to a shard that does not hold it
// yet. Checked before the new assignments are written, so a refused run
// leaves the file as it was. (It trusts the file to match what is live — a
// full run that failed midway has already moved it; follow that with a full
// deploy, not --only.)
if (only) {
  const moved = Object.entries(assignments)
    .filter(([folder, letter]) => previous[folder] !== letter)
    .map(
      ([folder, letter]) =>
        `${folder} (${previous[folder] ?? "new"} → ${letter})`
    );
  if (moved.length > 0) {
    throw new Error(
      `--only refused: folders changed shard, so every Worker must redeploy: ${moved.join(", ")}`
    );
  }
}
const sorted = Object.fromEntries(
  Object.entries(assignments).toSorted(([a], [b]) => a.localeCompare(b))
);
await writeFile(ASSIGNMENTS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);

const unknown = (only ?? []).filter(
  (key) => key !== "root" && !shards.some((shard) => shard.letter === key)
);
if (only?.length === 0) {
  throw new Error("--only= needs at least one shard letter or root.");
}
if (unknown.length > 0) {
  throw new Error(`--only names unknown shards: ${unknown.join(", ")}`);
}
const wanted = (key: string) => !only || only.includes(key);

/** Part files and the ignore file are deploy-time scratch, never left in dist/. */
async function cleanDist(): Promise<void> {
  // A stale .assetsignore would silently shrink a later plain `wrangler
  // deploy` or `wrangler dev` to one shard's view of dist.
  await rm(IGNORE_PATH, { force: true });
  for (const name of await readdir(DIST)) {
    if (isPart(name)) {
      await rm(path.join(DIST, name), { force: true });
    }
  }
}

try {
  const oversize = await splitOversize(oversizeRoot),
    configs = await generateConfigs(shards, oversize);

  console.log(`dist/: ${rootFiles} root files + ${folders.length} folders\n`);
  for (const shard of shards) {
    console.log(
      `  ${serviceNameOf(shard.letter)}  ${String(shard.files).padStart(6)} files  ${shard.folders.length} folders  (budget ${BUDGET}, cap ${MAX_ASSETS})`
    );
  }
  console.log(
    `  digest-law (root)   ${String(rootFiles).padStart(6)} files  + worker, /api/*, /id/*`
  );
  for (const [urlPath, asset] of Object.entries(oversize)) {
    console.log(
      `    ${urlPath} (${(asset.size / 1024 / 1024).toFixed(1)} MiB) → ${asset.parts.length} parts, reassembled by the root Worker`
    );
  }
  console.log("");

  await preflight(shards, oversize, configs);

  if (planOnly) {
    console.log("--plan: configs written to .wrangler-shards/, not deploying.");
  } else {
    for (const shard of shards.filter((s) => wanted(s.letter))) {
      console.log(`\n=== deploying ${serviceNameOf(shard.letter)} ===`);
      await writeFile(IGNORE_PATH, configs.shardIgnoreOf(shard));
      deploy(configs.shardConfigPathOf(shard));
    }
    if (wanted("root")) {
      console.log("\n=== deploying digest-law (root) ===");
      await writeFile(IGNORE_PATH, configs.rootIgnore);
      deploy(configs.rootConfigPath);
    }
    console.log(
      only
        ? `\nDeployed: ${only.join(", ")}.`
        : `\nAll ${shards.length + 1} Workers deployed.`
    );
  }
} finally {
  await cleanDist();
}
