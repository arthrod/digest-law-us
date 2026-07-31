#!/usr/bin/env bun
/**
 * Allocate public concept ids for corpus concepts that do not have one yet.
 *
 *   bun run ids:mint    append records for new concepts, rewrite the registry
 *   bun run ids:check   report only; non-zero exit if anything is unminted
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
import { mintConceptId, validateRegistry } from "../src/lib/concept-ids";
import { humanize, slugPathOf } from "../src/lib/labels";

const REGISTRY_PATH = path.resolve(
  import.meta.dirname,
  "../src/data/concept-ids.json"
);
const corpusRoot = path.resolve(CORPUS_DIR);
const checkOnly = process.argv.includes("--check");

interface CorpusConcept {
  corpusIssueId?: string;
  label: string;
  pathNotation?: string;
  slugPath: string;
}

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
const orphans = registry.concepts.filter(
  (record) => !(record.retired || record.keys.some((k) => liveKeys.has(k)))
);

process.stdout.write(
  `corpus concepts: ${concepts.length}\n` +
    `registry records: ${registry.concepts.length}\n` +
    `unminted: ${unminted.length}\n` +
    `orphaned records (key no longer in corpus): ${orphans.length}\n`
);
reportOrphans(orphans);

if (checkOnly) {
  const found = validateRegistry(registry);
  for (const problem of found) {
    process.stderr.write(`integrity: ${problem}\n`);
  }
  process.exit(unminted.length === 0 && found.length === 0 ? 0 : 1);
}

const minted = today();
for (const concept of unminted) {
  const { id, uuid } = mintConceptId();
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
  `minted ${unminted.length} new id(s); registry now holds ${registry.concepts.length}\n`
);
