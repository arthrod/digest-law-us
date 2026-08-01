#!/usr/bin/env bun
/**
 * Reconcile the concept-identity registry with the corpus.
 *
 *   bun run ids:mint    mint ids for new concepts, tombstone what a purge
 *                       removed, lift the tombstone off anything regenerated
 *   bun run ids:check   report only; non-zero exit if the registry and the
 *                       corpus disagree in either direction
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
);
const corpusRoot = path.resolve(CORPUS_DIR);
const checkOnly = process.argv.includes("--check");

interface CorpusConcept {
  /** Identity the runner allocated at generation time, when it did. */
  conceptId?: string;
  corpusIssueId?: string;
  label: string;
  pathNotation?: string;
  slugPath: string;
}

const CONCEPT_ID_FORM = /^[0-9a-f]{32}$/u;

const FIELD = /^(?<key>[a-z_]+):\s*"?(?<value>[^"\n]*?)"?\s*$/u;

async function frontmatterOf(file: string): Promise<Record<string, string>> {
  let head: string;
  try {
    const text = await readFile(file, "utf8");
    head = text.slice(0, 8192);
  } catch {
    return {};
  }
  if (!head.startsWith("---")) {
    return {};
  }
  const end = head.indexOf("\n---", 3);
  const block = head.slice(3, end === -1 ? undefined : end);
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = FIELD.exec(line);
    if (match?.groups?.key && match.groups.value) {
      fields[match.groups.key] = match.groups.value;
    }
  }
  return fields;
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
      const full = path.join(dir, entry.name);
      // A bundle's digest is the .md named after its own directory (corpus.ts).
      const fm = await frontmatterOf(path.join(full, `${entry.name}.md`));
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
) as ConceptRegistry;

const existingKeys = new Set<string>();
for (const record of registry.concepts) {
  for (const key of record.keys) {
    existingKeys.add(key);
  }
}

const concepts: CorpusConcept[] = [];
await collect(corpusRoot, concepts);

if (concepts.length === 0) {
  process.stderr.write(
    `No corpus concepts found under ${corpusRoot}.\n` +
      "Set CORPUS_DIR to the key-digest-runner checkout and retry.\n"
  );
  process.exit(1);
}

const unminted = concepts.filter((c) => !existingKeys.has(c.slugPath));
const liveKeys = new Set(concepts.map((c) => c.slugPath));
const orphans = orphansOf(registry, liveKeys);
const buried = registry.concepts.filter(
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

const minted = today();
const takenIds = new Set(registry.concepts.map((record) => record.id));
let adopted = 0;
for (const concept of unminted) {
  // The runner allocates identity at generation time (skos_okf.py). When a
  // digest arrives carrying its own concept_id, adopt it instead of minting a
  // second id for the same concept — two ids for one concept is precisely the
  // ambiguity this registry exists to prevent. A malformed or already-taken
  // value is refused, not silently trusted.
  const supplied = concept.conceptId?.toLowerCase();
  const adoptable =
    supplied && CONCEPT_ID_FORM.test(supplied) && !takenIds.has(supplied);
  if (supplied && !adoptable) {
    process.stderr.write(
      `refused concept_id "${supplied}" on ${concept.slugPath}: ` +
        `${CONCEPT_ID_FORM.test(supplied) ? "already in the registry" : "malformed"}\n`
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
    `concept_id, ${unminted.length - adopted} minted here; registry now holds ` +
    `${registry.concepts.length}\n` +
    `retired ${retired.length} (tombstoned, 410 Gone), ` +
    `restored ${restored.length} (route regenerated)\n`
);
