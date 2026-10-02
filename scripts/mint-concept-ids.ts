#!/usr/bin/env bun
/**
 * Reconcile the concept-identity registry with the corpus.
 *
 *   bun run ids:mint    mint ids for new concepts, tombstone what a purge
 *                       removed, lift the tombstone off anything regenerated
 *   bun run ids:check   report only; non-zero exit if the registry and the
 *                       corpus disagree in either direction
 *
 *   --from-git <repo> [ref]   read the corpus from a git ref of the runner
 *                       repo (default origin/main) instead of CORPUS_DIR —
 *                       the local checkout is often behind, and minting
 *                       against a stale tree tombstones live concepts.
 *
 * Both halves matter. A purge that deletes bundles without retiring their ids
 * leaves `/id-map.json` advertising routes that 404, so `/id/{id}` answers
 * "moved here" about a page that is gone. `ids:check` fails on that, which is
 * what stops a purge from being merged half-done.
 *
 * What it will not do: rebind a key. If a concept is renamed or reparented,
 * its old route key goes orphaned and a new path shows up unminted — the two
 * are only the same concept if an editor says so, and saying so means adding
 * the new key to the existing record by hand (P1-014H). Guessing here would
 * silently fabricate identity continuity, which is the whole thing this
 * registry exists to prevent.
 */

import type { Dirent } from "node:fs";
import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CORPUS_DIR } from "../src/corpus.config";
import type { ConceptRecord, ConceptRegistry } from "../src/lib/concept-ids";
import {
  dashedUuid,
  mintConceptId,
  orphansOf,
  reconcileRegistry,
  validateRegistry,
} from "../src/lib/concept-ids";
import { humanize, slugPathOf } from "../src/lib/labels";

const REGISTRY_PATH = path.resolve(
    import.meta.dirname,
    "../src/data/concept-ids.json"
  ),
  corpusRoot = path.resolve(CORPUS_DIR),
  checkOnly = process.argv.includes("--check"),
  gitAt = process.argv.indexOf("--from-git"),
  gitRepo = gitAt === -1 ? undefined : process.argv[gitAt + 1],
  gitRef =
    gitAt === -1 || process.argv[gitAt + 2]?.startsWith("--")
      ? "origin/main"
      : (process.argv[gitAt + 2] ?? "origin/main"),
  OKF_IN_REPO = "key_digest/american_legal_digest/okf";

interface CorpusConcept {
  /** Identity the runner allocated at generation time, when it did. */
  conceptId?: string;
  corpusIssueId?: string;
  label: string;
  pathNotation?: string;
  slugPath: string;
}

const CONCEPT_ID_FORM = /^[0-9a-f]{32}$/u,
  /** The runner mints random UUIDv4 ids (skos_okf.mint_concept_id): version
   *  nibble 4, RFC 4122 variant. Anything else in a digest's `concept_id` was
   *  written by the model — a copied placement-derived issue_id (UUIDv5) or a
   *  placeholder such as a1b2c3d4… — and is not identity. */
  RANDOM_V4 = /^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/u,
  PLACEHOLDER = /^(?:a1b2c3d4|0{8}|1{8}|f{8}|12345678|01234567|deadbeef|abcdef01)/u,
  FIELD = /^(?<key>[a-z_]+):\s*"?(?<value>[^"\n]*?)"?\s*$/u;

function parseFrontmatter(head: string): Record<string, string> {
  if (!head.startsWith("---")) {
    return {};
  }
  const end = head.indexOf("\n---", 3),
    block = head.slice(3, end === -1 ? undefined : end),
    fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = FIELD.exec(line);
    if (match?.groups?.key && match.groups.value) {
      fields[match.groups.key] = match.groups.value;
    }
  }
  return fields;
}

async function frontmatterOf(file: string): Promise<Record<string, string>> {
  try {
    return parseFrontmatter((await readFile(file, "utf8")).slice(0, 8192));
  } catch {
    return {};
  }
}

function git(repo: string, args: string[], input?: string): Buffer {
  const result = spawnSync("git", ["-C", repo, ...args], {
    input,
    maxBuffer: 2 ** 31,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
  }
  return result.stdout;
}

/**
 * The same concepts `collect` finds, read from a git tree: every directory
 * under the okf root except `sources/` subtrees and dot-directories, with the
 * frontmatter of its own `<dir>/<dir>.md` when that file exists.
 */
function collectFromGit(repo: string, ref: string): CorpusConcept[] {
  const files = git(repo, ["ls-tree", "-r", "--name-only", ref, "--", OKF_IN_REPO])
      .toString()
      .split("\n")
      .filter(Boolean)
      .map((f) => f.slice(OKF_IN_REPO.length + 1)),
    dirs = new Set<string>(),
    fileSet = new Set(files);
  for (const file of files) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const segment = parts[i - 1];
      if (segment === "sources" || segment.startsWith(".")) {
        break;
      }
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  const digests = [...dirs]
      .map((dir) => `${dir}/${dir.split("/").at(-1)}.md`)
      .filter((file) => fileSet.has(file)),
    heads = new Map<string, Record<string, string>>(),
    batch = git(
      repo,
      ["cat-file", "--batch"],
      digests.map((d) => `${ref}:${OKF_IN_REPO}/${d}\n`).join("")
    );
  let at = 0;
  for (const digest of digests) {
    const nl = batch.indexOf(10, at),
      size = Number(batch.subarray(at, nl).toString().split(" ")[2]),
      body = batch.subarray(nl + 1, nl + 1 + Math.min(size, 8192)).toString();
    heads.set(digest.slice(0, digest.lastIndexOf("/")), parseFrontmatter(body));
    at = nl + 1 + size + 1;
  }
  return [...dirs].map((dir) => {
    const fm = heads.get(dir) ?? {};
    return {
      conceptId: fm.concept_id,
      corpusIssueId: fm.issue_id,
      label: fm.pref_label ?? fm.title ?? humanize(dir.split("/").at(-1) ?? dir),
      pathNotation: fm.notation,
      slugPath: slugPathOf(dir),
    };
  });
}

async function collect(dir: string, out: CorpusConcept[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const dirs = entries.filter(
    (e) => e.isDirectory() && e.name !== "sources" && !e.name.startsWith(".")
  );
  await Promise.all(
    dirs.map(async (entry) => {
      const full = path.join(dir, entry.name),
        // A bundle's digest is the .md named after its own directory (corpus.ts).
        fm = await frontmatterOf(path.join(full, `${entry.name}.md`));
      out.push({
        conceptId: fm.concept_id,
        corpusIssueId: fm.issue_id,
        label: fm.pref_label ?? fm.title ?? humanize(entry.name),
        pathNotation: fm.notation,
        slugPath: slugPathOf(path.relative(corpusRoot, full)),
      });
      await collect(full, out);
    })
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function reportOrphans(orphans: ConceptRecord[]): void {
  for (const record of orphans.slice(0, 20)) {
    process.stdout.write(
      `  orphan ${record.id} last key "${record.keys.at(-1)}" (${record.label})\n`
    );
  }
  if (orphans.length > 20) {
    process.stdout.write(`  … and ${orphans.length - 20} more\n`);
  }
}

const registry = JSON.parse(
    await readFile(REGISTRY_PATH, "utf8")
  ) as ConceptRegistry,
  existingKeys = new Set<string>();
for (const record of registry.concepts) {
  for (const key of record.keys) {
    existingKeys.add(key);
  }
}

const concepts: CorpusConcept[] = [];
if (gitRepo) {
  concepts.push(...collectFromGit(gitRepo, gitRef));
} else {
  await collect(corpusRoot, concepts);
}

if (concepts.length === 0) {
  process.stderr.write(
    `No corpus concepts found under ${corpusRoot}.\n` +
      "Set CORPUS_DIR to the key-digest-runner checkout and retry.\n"
  );
  process.exit(1);
}

const unminted = concepts.filter((c) => !existingKeys.has(c.slugPath)),
  liveKeys = new Set(concepts.map((c) => c.slugPath)),
  orphans = orphansOf(registry, liveKeys),
  buried = registry.concepts.filter(
    (record) => record.retired && record.keys.some((k) => liveKeys.has(k))
  );

process.stdout.write(
  `corpus concepts: ${concepts.length}\n` +
    `registry records: ${registry.concepts.length}\n` +
    `unminted: ${unminted.length}\n` +
    `orphaned records (key no longer in corpus): ${orphans.length}\n` +
    `retired records whose route is live again: ${buried.length}\n`
);
reportOrphans(orphans);

if (checkOnly) {
  const found = validateRegistry(registry);
  for (const problem of found) {
    process.stderr.write(`integrity: ${problem}\n`);
  }
  // An orphan is a purge that was never finished: the id still resolves to a
  // route that is gone. Reporting it and passing would let that ship.
  if (orphans.length > 0 || buried.length > 0) {
    process.stderr.write("run `bun run ids:mint` to reconcile\n");
  }
  process.exit(
    unminted.length === 0 &&
      orphans.length === 0 &&
      buried.length === 0 &&
      found.length === 0
      ? 0
      : 1
  );
}

const minted = today(),
  takenIds = new Set(registry.concepts.map((record) => record.id));
let adopted = 0,
  refused = 0;
const issueIds = new Set(
  concepts
    .map((c) => c.corpusIssueId?.replaceAll("-", "").toLowerCase())
    .filter((id): id is string => Boolean(id))
);
for (const concept of unminted) {
  // The runner allocates identity at generation time (skos_okf.py). When a
  // digest arrives carrying its own concept_id, adopt it instead of minting a
  // second id for the same concept — two ids for one concept is precisely the
  // ambiguity this registry exists to prevent. A malformed or already-taken
  // value is refused, not silently trusted.
  const supplied = concept.conceptId?.toLowerCase(),
    why = !supplied
      ? ""
      : !CONCEPT_ID_FORM.test(supplied)
        ? "malformed"
        : takenIds.has(supplied)
          ? "already in the registry"
          : issueIds.has(supplied)
            ? "is a corpus issue_id (placement-derived), not identity"
            : PLACEHOLDER.test(supplied) || !RANDOM_V4.test(supplied)
              ? "not a runner-minted random id"
              : "",
    adoptable = Boolean(supplied) && why === "";
  if (supplied && !adoptable) {
    refused += 1;
    process.stderr.write(
      `refused concept_id "${supplied}" on ${concept.slugPath}: ${why}\n`
    );
  }
  const { id, uuid } = adoptable
    ? { id: supplied, uuid: dashedUuid(supplied) }
    : mintConceptId();
  takenIds.add(id);
  if (adoptable) {
    adopted += 1;
  }
  registry.concepts.push({
    id,
    keys: [concept.slugPath],
    label: concept.label,
    minted,
    uuid,
    ...(concept.corpusIssueId ? { corpusIssueId: concept.corpusIssueId } : {}),
    ...(concept.pathNotation ? { pathNotation: concept.pathNotation } : {}),
  });
}

// Tombstone what a purge took, and lift the tombstone off anything that came
// back. Neither deletes a record or frees an id (P1-014H).
const { restored, retired } = reconcileRegistry(registry, liveKeys, minted);

registry.concepts.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));

const problems = validateRegistry(registry);
if (problems.length > 0) {
  for (const problem of problems) {
    process.stderr.write(`integrity: ${problem}\n`);
  }
  process.stderr.write("registry NOT written\n");
  process.exit(1);
}

await writeFile(
  REGISTRY_PATH,
  `${JSON.stringify(registry, null, 2)}\n`,
  "utf8"
);
process.stdout.write(
  `added ${unminted.length} record(s) — ${adopted} adopted from runner ` +
    `concept_id (${refused} refused), ${unminted.length - adopted} minted here; registry now holds ` +
    `${registry.concepts.length}\n` +
    `retired ${retired.length} (tombstoned, 410 Gone), ` +
    `restored ${restored.length} (route regenerated)\n`
);
