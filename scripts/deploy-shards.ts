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
 * Deliberately NOT handled: a single top-level folder larger than the 100k
 * cap. That needs a second nesting level and a human decision — this script
 * refuses loudly instead.
 */

import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
/** wrangler rejects run_worker_first arrays longer than this. */
 MAX_RUN_WORKER_FIRST_RULES = 100,

 planOnly = process.argv.includes("--plan");

// ---------------------------------------------------------------------------
// JSONC — wrangler.jsonc is the single source of truth for the root Worker,
// so the generated configs inherit from it rather than duplicating it.
// ---------------------------------------------------------------------------

/** Strip // and slash-star comments, then trailing commas — string-aware. */
function parseJsonc(text: string): Record<string, unknown> {
  let out = "",
   inString = false,
   i = 0;
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

async function inventory(): Promise<{ folders: Folder[]; rootFiles: number }> {
  let entries: Dirent[];
  try {
    entries = await readdir(DIST, { withFileTypes: true });
  } catch {
    throw new Error(`No ${DIST} — run the build first.`);
  }
  const folders: Folder[] = [];
  let rootFiles = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nested = await readdir(path.join(DIST, entry.name), {
        recursive: true,
        withFileTypes: true,
      });
      folders.push({
        files: nested.filter((n) => n.isFile()).length,
        name: entry.name,
      });
    } else if (entry.name !== ".assetsignore") {
      rootFiles += 1;
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, rootFiles };
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

/** Root keeps only root-level files: every sharded folder is excluded. */
function rootIgnoreFile(shards: Shard[]): string {
  const lines = shards.flatMap((shard) =>
    shard.folders.map((folder) => `/${folder.name}/`)
  );
  return `${lines.toSorted().join("\n")}\n`;
}

/**
 * One `/{folder}*` rule per sharded folder. Trailing `*` is a cross-segment
 * prefix match, so a rule that another folder's name extends (criminal-law vs
 * criminal-law-public-order-…) covers both — and wrangler hard-errors on the
 * redundant longer rule, so it must be dropped here. Over-matching is safe:
 * the Worker routes by exact first segment and falls back to its own assets.
 */
function runWorkerFirstRules(base: string[], shards: Shard[]): string[] {
  const folderRules = shards
    .flatMap((shard) => shard.folders.map((folder) => `/${folder.name}*`))
    .toSorted(),
   rules = [...base];
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

async function generateConfigs(shards: Shard[]): Promise<GeneratedConfigs> {
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
      run_worker_first: runWorkerFirstRules(baseRules, shards),
    },
    main: "../worker/index.ts",
    services: shards.map((shard) => ({
      binding: bindingNameOf(shard.letter),
      service: serviceNameOf(shard.letter),
    })),
    vars: {
      ...(base.vars as Record<string, unknown> | undefined),
      SHARD_MAP: shardMap,
    },
  },
   rootConfigPath = path.join(OUT_DIR, "root.json");
  await writeFile(rootConfigPath, `${JSON.stringify(rootConfig, null, 2)}\n`);

  return {
    rootConfigPath,
    rootIgnore: rootIgnoreFile(shards),
    shardConfigPathOf: (shard) =>
      path.join(OUT_DIR, `shard-${shard.letter}.json`),
    shardIgnoreOf: shardIgnoreFile,
  };
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

const { folders, rootFiles } = await inventory(),
 shards = pack(folders, await loadAssignments()),

 assignments: Assignments = {};
for (const shard of shards) {
  for (const folder of shard.folders) {
    assignments[folder.name] = shard.letter;
  }
}
const sorted = Object.fromEntries(
  Object.entries(assignments).toSorted(([a], [b]) => a.localeCompare(b))
);
await writeFile(ASSIGNMENTS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);

const configs = await generateConfigs(shards);

console.log(`dist/: ${rootFiles} root files + ${folders.length} folders\n`);
for (const shard of shards) {
  console.log(
    `  ${serviceNameOf(shard.letter)}  ${String(shard.files).padStart(6)} files  ${shard.folders.length} folders  (budget ${BUDGET}, cap ${MAX_ASSETS})`
  );
}
console.log(
  `  digest-law (root)   ${String(rootFiles).padStart(6)} files  + worker, /api/*, /id/*\n`
);

if (planOnly) {
  console.log("--plan: configs written to .wrangler-shards/, not deploying.");
  process.exit(0);
}

try {
  for (const shard of shards) {
    console.log(`\n=== deploying ${serviceNameOf(shard.letter)} ===`);
    await writeFile(IGNORE_PATH, configs.shardIgnoreOf(shard));
    deploy(configs.shardConfigPathOf(shard));
  }
  console.log("\n=== deploying digest-law (root) ===");
  await writeFile(IGNORE_PATH, configs.rootIgnore);
  deploy(configs.rootConfigPath);
} finally {
  // A stale .assetsignore would silently shrink a later plain `wrangler
  // deploy` or `wrangler dev` to one shard's view of dist.
  await rm(IGNORE_PATH, { force: true });
}
console.log(`\nAll ${shards.length + 1} Workers deployed.`);
