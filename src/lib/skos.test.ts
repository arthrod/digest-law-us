/**
 * SKOS export profile: label integrity (P1-014B), language tagging
 * (P1-014I), placement-versus-hierarchy (S-02 / P1-006), and typed notation
 * (P1-014C).
 */
import { describe, expect, test } from "bun:test";

import type { Corpus, TreeNode } from "./corpus";
import { CONCEPT_ID_DATATYPE } from "./iri";
import { conceptFor, labelSetFor } from "./skos";

type Frontmatter = Record<string, unknown>;

function node(slugPath: string, data?: Frontmatter): TreeNode {
  const segment = slugPath.split("/").at(-1) ?? slugPath;
  return {
    children: [],
    digest: data
      ? ({ data, id: slugPath } as unknown as TreeNode["digest"])
      : undefined,
    dir: slugPath,
    label: segment,
    latest: "",
    maxDepth: 0,
    ownSourceCount: 0,
    segment,
    slugPath,
    sourceCount: 0,
    topicCount: 0,
  };
}

function corpusOf(...nodes: TreeNode[]): Corpus {
  const nodeBySlugPath = new Map(nodes.map((n) => [n.slugPath, n]));
  return { areas: [], nodeBySlugPath } as unknown as Corpus;
}

const URN = "urn:legal-taxonomy:issue:EVIDENCE_LAW.DOCUMENTARY_EVIDENCE";

describe("label integrity (P1-014B)", () => {
  test("alt and historical labels duplicating prefLabel are dropped", () => {
    const set = labelSetFor({
      altLabels: ["log books as evidence", "Logbooks"],
      historicalLabels: ["  LOG BOOKS AS EVIDENCE  "],
      prefLabel: "Log Books as Evidence",
    });
    expect(set.altLabels).toEqual(["Logbooks"]);
    expect(set.historicalLabels).toEqual([]);
    expect(set.violations).toHaveLength(2);
    expect(set.violations.join(" ")).toContain("duplicates prefLabel");
  });

  test("alt and historical label sets are disjoint from each other", () => {
    const set = labelSetFor({
      altLabels: ["Deposit"],
      historicalLabels: ["deposit"],
      prefLabel: "Bailment",
    });
    expect(set.historicalLabels).toEqual([]);
    expect(set.violations.join(" ")).toContain("duplicates altLabel");
  });

  test("exactly one prefLabel is emitted", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law", { pref_label: "EVIDENCE_LAW" })
    );
    expect(Array.isArray(concept["skos:prefLabel"])).toBe(false);
  });

  test("historical labels are not skos:hiddenLabel (S-04)", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law/proof-of-writings", {
        historical_labels: ["Proof of Instruments"],
        pref_label: "PROOF OF WRITINGS",
      })
    );
    expect(concept["skos:hiddenLabel"]).toBeUndefined();
    expect(concept["digest:historicalLabel"]).toEqual([
      { "@language": "en", "@value": "Proof of Instruments" },
    ]);
  });
});

describe("language tagging (P1-014I)", () => {
  test("natural-language literals carry the scheme language by default", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law/x", {
        definition: "A rule about proof.",
        pref_label: "X",
        scope_note: "Use for questions about proof.",
      })
    );
    expect(concept["skos:prefLabel"]).toMatchObject({ "@language": "en" });
    expect(concept["skos:definition"]).toMatchObject({ "@language": "en" });
    expect(concept["skos:scopeNote"]).toEqual([
      { "@language": "en", "@value": "Use for questions about proof." },
    ]);
  });

  test("a record's own BCP 47 tag wins over the scheme default", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law/x", {
        definition: "Una regla sobre la prueba.",
        language: "es-MX",
        pref_label: "Prueba de escritos",
      })
    );
    expect(concept["skos:prefLabel"]).toMatchObject({ "@language": "es-MX" });
    expect(concept["skos:definition"]).toMatchObject({ "@language": "es-MX" });
  });

  test("a malformed tag falls back rather than emitting invalid RDF", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law/x", { language: "not a tag!", pref_label: "X" })
    );
    expect(concept["skos:prefLabel"]).toMatchObject({ "@language": "en" });
  });

  test("extension and private-use tags survive instead of falling back", () => {
    // These are introduced by a SINGLE character, so a pattern demanding 2-8
    // per subtag rejects them. The fallback is not a safe default here: it
    // replaces a valid tag with "en" and publishes a false claim about the
    // literal's language.
    for (const tag of ["en-u-nu-latn", "en-x-test", "ar-u-nu-arab-x-priv"]) {
      const concept = conceptFor(
        corpusOf(),
        node("evidence-law/x", { language: tag, pref_label: "X" })
      );
      expect(concept["skos:prefLabel"]).toMatchObject({ "@language": tag });
    }
  });

  test("a lone singleton with nothing after it is still malformed", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law/x", { language: "en-u", pref_label: "X" })
    );
    expect(concept["skos:prefLabel"]).toMatchObject({ "@language": "en" });
  });

  test("identifiers, notations and dates are never language-tagged", () => {
    const concept = conceptFor(
      corpusOf(),
      node("evidence-law/x", {
        created: "2026-07-15",
        issue_id: "ec8f3429-f890-5a27-88da-6423931a36b1",
        modified: "2026-07-16",
        notation: "EVIDENCE_LAW.X",
        pref_label: "X",
      })
    );
    expect(concept["digest:pathNotation"]).toBe("EVIDENCE_LAW.X");
    expect(concept["digest:corpusIssueId"]).toBe(
      "ec8f3429-f890-5a27-88da-6423931a36b1"
    );
    expect(concept["dct:created"]).toEqual({
      "@type": "xsd:date",
      "@value": "2026-07-15",
    });
    for (const key of [
      "digest:pathNotation",
      "digest:corpusIssueId",
      "dct:created",
      "dct:modified",
    ]) {
      expect(JSON.stringify(concept[key])).not.toContain("@language");
    }
  });
});

describe("placement is not hierarchy (S-02 / P1-006)", () => {
  test("the folder parent does not become skos:broader", () => {
    const child = node("evidence-law/documentary-evidence/log-books", {
      pref_label: "LOG BOOKS",
    }),
     concept = conceptFor(corpusOf(child), child);
    expect(concept["skos:broader"]).toBeUndefined();
    expect(concept["digest:placementParent"]).toBeDefined();
  });

  test("only the drafter's asserted broader is published", () => {
    const parent = node("evidence-law/documentary-evidence"),
     child = node("evidence-law/documentary-evidence/log-books", {
      broader: [URN],
      pref_label: "LOG BOOKS",
    }),
     concept = conceptFor(corpusOf(parent, child), child);
    expect(concept["skos:broader"]).toHaveLength(1);
  });

  test("structural children are placement, not skos:narrower", () => {
    const parent = node("evidence-law/documentary-evidence"),
     child = node("evidence-law/documentary-evidence/log-books");
    parent.children = [child];
    const concept = conceptFor(corpusOf(parent, child), parent);
    expect(concept["skos:narrower"]).toBeUndefined();
    expect(concept["digest:placementChild"]).toHaveLength(1);
  });
});

describe("identity block (P1-001 / P1-014C)", () => {
  test("unminted concepts publish the legacy route IRI and no notation", () => {
    const concept = conceptFor(corpusOf(), node("evidence-law/unminted"));
    expect(concept["@id"]).toBe(
      "https://w3id.org/digest-law/us/evidence-law/unminted/"
    );
    expect(concept["skos:notation"]).toBeUndefined();
  });

  test("the legacy route IRI is always published so citations resolve", () => {
    const concept = conceptFor(corpusOf(), node("evidence-law/x"));
    expect(concept["digest:legacyIri"]).toEqual({
      "@id": "https://w3id.org/digest-law/us/evidence-law/x/",
    });
  });

  test("the concept-id datatype is the project datatype, not a bare string", () => {
    expect(CONCEPT_ID_DATATYPE).toBe(
      "https://w3id.org/digest-law/datatype/concept-id"
    );
  });
});
