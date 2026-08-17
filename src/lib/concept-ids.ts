/**
 * The concept-identity registry (P1-001, P1-002, P1-014C, P1-014H).
 *
 * Why a registry at all: the corpus `issue_id` looks like an opaque UUID but
 * is derived from the issue's placement — in `issues_v3.jsonl` the label
 * "INTENT" carries four different UUIDs under four different area paths, and
 * every UUID maps to exactly one label. Publishing it as identity would make
 * public IRIs churn on every reparent, which is the defect P1-001 exists to
 * fix. So identity is *allocated here, once*, and the corpus id is kept only
 * as provenance.
 *
 * The registry is append-only and committed:
 *   - an id, once minted, is never reused and never reassigned;
 *   - a rename or reparent appends the new route key to the existing record,
 *     leaving `id` untouched — that is what keeps `@id` stable;
 *   - a retired concept keeps its id and its keys forever (tombstone).
 *
 * Rebinding a moved concept is an editorial act, so `mint-concept-ids.ts`
 * reports orphaned keys rather than guessing which new path is the old one.
 */

import registryFile from "../data/concept-ids.json";
import { CONCEPT_BASE, W3ID_BASE } from "./iri";

export interface ConceptRecord {
  /** 32 lowercase hex chars — the public identity. Never changes. */
  id: string;
  /** Same 128 bits, dashed; published as `dct:identifier`. */
  uuid: string;
  /**
   * Route keys (slug paths) this concept has been published under, oldest
   * first. Append on rename/reparent; never remove.
   */
  keys: string[];
  /** ISO date the id was allocated. */
  minted: string;
  /** Label at mint time — a diagnostic aid, never identity. */
  label: string;
  /** Corpus `issue_id` (UUIDv5, placement-derived) — provenance only. */
  corpusIssueId?: string;
  /** Corpus dotted notation at mint time — a route artifact, not identity. */
  pathNotation?: string;
  /** ISO date of retirement; the id and keys stay resolvable forever. */
  retired?: string;
}

export interface ConceptRegistry {
  version: number;
  policy: string;
  concepts: ConceptRecord[];
}

const registry = registryFile as ConceptRegistry,

 byKey = new Map<string, ConceptRecord>();
for (const record of registry.concepts) {
  for (const key of record.keys) {
    byKey.set(key, record);
  }
}

/** The registry as loaded (read-only view for scripts and reports). */
export function allConcepts(): readonly ConceptRecord[] {
  return registry.concepts;
}

/** Registry record for a route key, current or historical. */
export function conceptRecordFor(slugPath: string): ConceptRecord | undefined {
  return byKey.get(slugPath);
}

export interface ConceptIri {
  /** The IRI to publish as `@id`. */
  iri: string;
  record?: ConceptRecord;
  /** false when this route has no registry entry (see `iri` fallback). */
  registered: boolean;
}

/** The route-derived IRI this concept was published under before P1-001. */
export function legacyIriFor(slugPath: string): string {
  return `${W3ID_BASE}${slugPath}/`;
}

/**
 * Public concept IRI for a route.
 *
 * Unregistered routes — corpus directories generated since the last mint —
 * fall back to the legacy route IRI so the build still produces a resolvable
 * graph. That fallback is *not* stable identity; `registered: false` is how
 * callers and `bun run ids:check` count what still needs minting.
 */
export function conceptIriFor(slugPath: string): ConceptIri {
  const record = byKey.get(slugPath);
  if (record) {
    return { iri: `${CONCEPT_BASE}${record.id}`, record, registered: true };
  }
  return { iri: legacyIriFor(slugPath), registered: false };
}

/** Allocate a fresh identity. Random, never derived from path or label. */
export function mintConceptId(): { id: string; uuid: string } {
  const uuid = crypto.randomUUID();
  return { id: uuid.replaceAll("-", ""), uuid };
}

/**
 * 8-4-4-4-12 form of a 32-hex id, for `dct:identifier`.
 *
 * Used when adopting a `concept_id` the runner allocated at generation time
 * (`skos_okf.mint_concept_id`), which arrives as bare hex.
 */
export function dashedUuid(id: string): string {
  const hex = id.toLowerCase();
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Records whose every route key has left the corpus and that are not already
 * tombstoned — i.e. concepts a purge removed.
 *
 * A record keeps its keys forever, so "gone" means *no* key is live, not that
 * the newest one is missing: a concept that was reparented still has its old
 * keys in the list and must not be mistaken for a casualty.
 */
export function orphansOf(
  reg: ConceptRegistry,
  liveKeys: ReadonlySet<string>
): ConceptRecord[] {
  return reg.concepts.filter(
    (record) =>
      !(record.retired || record.keys.some((key) => liveKeys.has(key)))
  );
}

export interface Reconciliation {
  /** Orphans tombstoned by this run. */
  retired: ConceptRecord[];
  /** Tombstoned records whose route is live again. */
  restored: ConceptRecord[];
}

/**
 * Bring the registry back into agreement with the corpus, in place.
 *
 * This is the other half of a purge. Deleting a bundle without retiring its id
 * leaves `/id-map.json` advertising a route that 404s, so the resolver answers
 * "moved here" about a page that is gone — worse than either honest answer.
 * A tombstoned id resolves to 410 Gone forever (worker/index.ts).
 *
 * The reverse matters just as much: a purged path can be regenerated later,
 * and because keys are append-only the old record is what claims it again. If
 * the tombstone stayed, that live concept would answer 410 forever. So a
 * returning route clears the retirement and keeps the id it always had —
 * resurrected, never re-minted.
 *
 * No record is deleted and no id is freed; retirement is one dated field.
 * Running it twice changes nothing.
 */
export function reconcileRegistry(
  reg: ConceptRegistry,
  liveKeys: ReadonlySet<string>,
  on: string
): Reconciliation {
  const retired = orphansOf(reg, liveKeys);
  for (const record of retired) {
    record.retired = on;
  }
  const restored = reg.concepts.filter(
    (record) => record.retired && record.keys.some((key) => liveKeys.has(key))
  );
  for (const record of restored) {
    delete record.retired;
  }
  return { restored, retired };
}

const ID_FORM = /^[0-9a-f]{32}$/u;

/**
 * Registry integrity: the invariants that make the ids trustworthy.
 * Returns one message per violation; empty means the registry is sound.
 */
export function validateRegistry(reg: ConceptRegistry): string[] {
  const problems: string[] = [],
   seenIds = new Map<string, number>(),
   seenUuids = new Set<string>(),
   seenKeys = new Map<string, string>();

  for (const [index, record] of reg.concepts.entries()) {
    if (!ID_FORM.test(record.id)) {
      problems.push(`#${index} (${record.id}): id is not 32 lowercase hex`);
    }
    if (record.uuid.replaceAll("-", "") !== record.id) {
      problems.push(`#${index} (${record.id}): uuid does not match id`);
    }
    const firstIndex = seenIds.get(record.id);
    if (firstIndex !== undefined) {
      problems.push(
        `#${index} (${record.id}): id reused — also record #${firstIndex}`
      );
    }
    seenIds.set(record.id, index);
    if (seenUuids.has(record.uuid)) {
      problems.push(`#${index} (${record.id}): uuid reused`);
    }
    seenUuids.add(record.uuid);
    if (record.keys.length === 0) {
      problems.push(`#${index} (${record.id}): no route key`);
    }
    for (const key of record.keys) {
      const owner = seenKeys.get(key);
      if (owner !== undefined && owner !== record.id) {
        problems.push(
          `#${index} (${record.id}): route key "${key}" already bound to ${owner}`
        );
      }
      seenKeys.set(key, record.id);
    }
  }

  return problems;
}
