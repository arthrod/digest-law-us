/**
 * P1-001 acceptance: "Rename/reparent tests preserve `@id`."
 * P1-014H: ids are never reused, retired records stay resolvable.
 */
import { describe, expect, test } from "bun:test";

import type { ConceptRegistry } from "./concept-ids";
import {
  allConcepts,
  conceptIriFor,
  dashedUuid,
  legacyIriFor,
  mintConceptId,
  validateRegistry,
} from "./concept-ids";
import { CONCEPT_BASE } from "./iri";

/** Registry lookup, standalone — mirrors the module's index over `keys`. */
function lookup(reg: ConceptRegistry, slugPath: string) {
  return reg.concepts.find((r) => r.keys.includes(slugPath));
}

function registryWith(keys: string[]): ConceptRegistry {
  const { id, uuid } = mintConceptId();
  return {
    concepts: [
      { id, keys, label: "Log Books as Evidence", minted: "2026-07-31", uuid },
    ],
    policy: "test",
    version: 1,
  };
}

describe("minting", () => {
  test("ids are 32 lowercase hex and match their dashed uuid", () => {
    const { id, uuid } = mintConceptId();
    expect(id).toMatch(/^[0-9a-f]{32}$/u);
    expect(uuid.replaceAll("-", "")).toBe(id);
  });

  test("ids are allocated, not derived from anything about the concept", () => {
    const a = mintConceptId();
    const b = mintConceptId();
    expect(a.id).not.toBe(b.id);
  });
});

describe("adopting a runner-allocated id", () => {
  test("bare hex from skos_okf.py converts to the dashed identifier form", () => {
    const { id, uuid } = mintConceptId();
    expect(dashedUuid(id)).toBe(uuid);
  });

  test("adoption keeps the id the digest was born with", () => {
    // The runner writes concept_id into frontmatter at generation time; the
    // registry must record that value, not allocate a competing one.
    const born = "9460d81470154e458335365e3b4c5014";
    const record = {
      id: born,
      keys: ["evidence-law/proof-of-writings"],
      label: "Proof of Writings",
      minted: "2026-07-31",
      uuid: dashedUuid(born),
    };
    const reg: ConceptRegistry = {
      concepts: [record],
      policy: "test",
      version: 1,
    };
    expect(validateRegistry(reg)).toEqual([]);
    expect(lookup(reg, "evidence-law/proof-of-writings")?.id).toBe(born);
  });
});

describe("rename and reparent preserve identity", () => {
  test("a renamed concept keeps its id when the new key is appended", () => {
    const reg = registryWith(["evidence-law/log-books-as-evidence"]);
    const before = lookup(reg, "evidence-law/log-books-as-evidence");
    expect(before).toBeDefined();

    // Rename: same concept, new route key appended (never replaced).
    reg.concepts[0].keys.push("evidence-law/logbooks-as-evidence");

    expect(lookup(reg, "evidence-law/logbooks-as-evidence")?.id).toBe(
      before?.id as string
    );
    // The old citation still resolves to the same concept.
    expect(lookup(reg, "evidence-law/log-books-as-evidence")?.id).toBe(
      before?.id as string
    );
  });

  test("a reparented concept keeps its id across a different branch", () => {
    const reg = registryWith([
      "evidence-law/documentary-evidence/log-books-as-evidence",
    ]);
    const [{ id }] = reg.concepts;

    reg.concepts[0].keys.push(
      "evidence-law/business-records/log-books-as-evidence"
    );

    expect(
      lookup(reg, "evidence-law/business-records/log-books-as-evidence")?.id
    ).toBe(id);
    expect(validateRegistry(reg)).toEqual([]);
  });
});

describe("registry integrity", () => {
  test("clean registry reports nothing", () => {
    expect(validateRegistry(registryWith(["a/b"]))).toEqual([]);
  });

  test("a reused id is a violation", () => {
    const reg = registryWith(["a/b"]);
    reg.concepts.push({
      id: reg.concepts[0].id,
      keys: ["c/d"],
      label: "Other",
      minted: "2026-07-31",
      uuid: reg.concepts[0].uuid,
    });
    expect(validateRegistry(reg).join(" ")).toContain("id reused");
  });

  test("one route key cannot belong to two concepts", () => {
    const reg = registryWith(["a/b"]);
    const { id, uuid } = mintConceptId();
    reg.concepts.push({
      id,
      keys: ["a/b"],
      label: "Impostor",
      minted: "2026-07-31",
      uuid,
    });
    expect(validateRegistry(reg).join(" ")).toContain("already bound");
  });

  test("id and uuid must describe the same bits", () => {
    const reg = registryWith(["a/b"]);
    reg.concepts[0].uuid = "00000000-0000-0000-0000-000000000000";
    expect(validateRegistry(reg).join(" ")).toContain("uuid does not match id");
  });

  test("a record with no route key is a violation", () => {
    const reg = registryWith([]);
    expect(validateRegistry(reg).join(" ")).toContain("no route key");
  });
});

describe("the committed registry", () => {
  const concepts = allConcepts();

  test("holds records and passes its own integrity rules", () => {
    expect(concepts.length).toBeGreaterThan(0);
    expect(
      validateRegistry({
        concepts: [...concepts],
        policy: "committed",
        version: 1,
      })
    ).toEqual([]);
  });

  test("every record resolves to its own concept IRI", () => {
    for (const record of concepts.slice(0, 200)) {
      const resolved = conceptIriFor(record.keys[0]);
      expect(resolved.registered).toBe(true);
      expect(resolved.iri).toBe(`${CONCEPT_BASE}${record.id}`);
    }
  });

  test("the corpus issue_id is stored as provenance, never as the id", () => {
    const withCorpusId = concepts.filter((r) => r.corpusIssueId);
    expect(withCorpusId.length).toBeGreaterThan(0);
    for (const record of withCorpusId.slice(0, 200)) {
      expect(record.id).not.toBe(record.corpusIssueId?.replaceAll("-", ""));
    }
  });
});

describe("IRI shape", () => {
  test("unregistered routes fall back to the legacy route IRI, flagged", () => {
    const resolved = conceptIriFor("no-such-area/no-such-topic");
    expect(resolved.registered).toBe(false);
    expect(resolved.iri).toBe(legacyIriFor("no-such-area/no-such-topic"));
    expect(resolved.iri).toContain("/digest-law/us/");
  });

  test("registered routes resolve into the concept namespace", () => {
    const reg = registryWith(["evidence-law/proof-of-writings"]);
    const record = lookup(reg, "evidence-law/proof-of-writings");
    expect(`${CONCEPT_BASE}${record?.id}`).toMatch(
      /^https:\/\/w3id\.org\/digest-law\/concept\/[0-9a-f]{32}$/u
    );
  });
});
