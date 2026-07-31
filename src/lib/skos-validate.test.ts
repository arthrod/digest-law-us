/**
 * P1-014B/C/D/E/F acceptance: "negative fixtures fail for the documented
 * reason". Each test names the constraint in
 * `public/profile/digest-skos-shapes.ttl` it exercises.
 */
import { describe, expect, test } from "bun:test";

import { validateSkosGraph } from "./skos-validate";

const A =
  "https://w3id.org/digest-law/concept/00000000000000000000000000000001";
const B =
  "https://w3id.org/digest-law/concept/00000000000000000000000000000002";
const C =
  "https://w3id.org/digest-law/concept/00000000000000000000000000000003";
const SCHEME = "https://w3id.org/digest-law/us/";
const DATATYPE = "https://w3id.org/digest-law/datatype/concept-id";

function concept(id: string, extra: Record<string, unknown> = {}) {
  const hex = id.split("/").at(-1) as string;
  return {
    "@id": id,
    "@type": "skos:Concept",
    "dct:identifier": [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-"),
    "skos:inScheme": { "@id": SCHEME },
    "skos:notation": { "@type": DATATYPE, "@value": hex },
    "skos:prefLabel": { "@language": "en", "@value": `Concept ${hex.at(-1)}` },
    ...extra,
  };
}

function graph(...nodes: Record<string, unknown>[]) {
  return { "@graph": nodes };
}

const messages = (nodes: Record<string, unknown>[]) =>
  validateSkosGraph(graph(...nodes))
    .map((v) => `${v.severity}: ${v.message}`)
    .join(" | ");

const violations = (nodes: Record<string, unknown>[]) =>
  validateSkosGraph(graph(...nodes)).filter((v) => v.severity === "violation");

describe("a well-formed graph", () => {
  test("passes clean", () => {
    expect(
      violations([concept(A), concept(B, { "skos:broader": { "@id": A } })])
    ).toEqual([]);
  });

  test("an empty graph is itself a finding", () => {
    expect(validateSkosGraph({ "@graph": [] })[0].message).toContain(
      "no skos:Concept"
    );
  });
});

describe("labels (P1-014B)", () => {
  test("two preferred labels in one language fail", () => {
    const node = concept(A, {
      "skos:prefLabel": [
        { "@language": "en", "@value": "One" },
        { "@language": "en", "@value": "Two" },
      ],
    });
    expect(messages([node])).toContain("SKOS S14");
  });

  test("two preferred labels in different languages are fine", () => {
    const node = concept(A, {
      "skos:prefLabel": [
        { "@language": "en", "@value": "Bailment" },
        { "@language": "fr", "@value": "Dépôt" },
      ],
    });
    expect(violations([node])).toEqual([]);
  });

  test("an untagged preferred label fails", () => {
    const node = concept(A, { "skos:prefLabel": { "@value": "Bailment" } });
    expect(messages([node])).toContain("no language tag");
  });

  test("alt duplicating pref fails, ignoring case and spacing", () => {
    const node = concept(A, {
      "skos:altLabel": { "@language": "en", "@value": "  concept 1  " },
      "skos:prefLabel": { "@language": "en", "@value": "Concept 1" },
    });
    expect(messages([node])).toContain("both prefLabel and altLabel");
  });

  test("historical duplicating alt fails", () => {
    const node = concept(A, {
      "digest:historicalLabel": { "@language": "en", "@value": "Deposit" },
      "skos:altLabel": { "@language": "en", "@value": "deposit" },
    });
    expect(messages([node])).toContain("both altLabel and historicalLabel");
  });

  test("the same term in two languages is not a duplicate", () => {
    const node = concept(A, {
      "skos:altLabel": { "@language": "fr", "@value": "Concept 1" },
    });
    expect(violations([node])).toEqual([]);
  });

  test("publishing skos:hiddenLabel at all fails", () => {
    const node = concept(A, {
      "skos:hiddenLabel": { "@language": "en", "@value": "Concpt 1" },
    });
    expect(messages([node])).toContain("historical labels belong in");
  });
});

describe("identity and notation (P1-014C)", () => {
  test("an untyped notation fails", () => {
    const node = concept(A, { "skos:notation": "EVIDENCE_LAW.X" });
    expect(messages([node])).toContain("not typed idtype:concept-id");
  });

  test("a notation that is not the concept id fails", () => {
    const node = concept(A, {
      "skos:notation": { "@type": DATATYPE, "@value": "f".repeat(32) },
    });
    expect(messages([node])).toContain("does not match the concept IRI");
  });

  test("two concepts sharing a notation fail", () => {
    const hex = A.split("/").at(-1) as string;
    const clash = concept(B, {
      "skos:notation": { "@type": DATATYPE, "@value": hex },
    });
    expect(messages([concept(A), clash])).toContain("is also used by");
  });

  test("a language-tagged identifier fails", () => {
    const node = concept(A, {
      "dct:identifier": { "@language": "en", "@value": "not-an-identifier" },
    });
    const text = messages([node]);
    expect(text).toContain("must not carry a language tag");
  });

  test("a language-tagged corpus issue id fails", () => {
    const node = concept(A, {
      "digest:corpusIssueId": { "@language": "en", "@value": "ec8f3429" },
    });
    expect(messages([node])).toContain(
      "digest:corpusIssueId must not carry a language tag"
    );
  });

  test("an unminted route IRI warns rather than fails", () => {
    const legacy = {
      "@id": "https://w3id.org/digest-law/us/evidence-law/x/",
      "@type": "skos:Concept",
      "skos:inScheme": { "@id": SCHEME },
      "skos:prefLabel": { "@language": "en", "@value": "X" },
    };
    const found = validateSkosGraph(graph(legacy));
    expect(found.filter((v) => v.severity === "violation")).toEqual([]);
    expect(found[0].message).toContain("no minted id");
  });

  test("an id outside the project namespaces fails", () => {
    const foreign = concept("https://example.org/concept/x");
    expect(messages([foreign])).toContain("outside the project namespaces");
  });
});

describe("hierarchy and association (P1-014D)", () => {
  test("self-broader fails", () => {
    expect(messages([concept(A, { "skos:broader": { "@id": A } })])).toContain(
      "its own skos:broader"
    );
  });

  test("a broader cycle fails and names the cycle", () => {
    const text = messages([
      concept(A, { "skos:broader": { "@id": B } }),
      concept(B, { "skos:broader": { "@id": A } }),
    ]);
    expect(text).toContain("broader cycle");
  });

  test("a longer cycle is caught too", () => {
    const text = messages([
      concept(A, { "skos:broader": { "@id": B } }),
      concept(B, { "skos:broader": { "@id": C } }),
      concept(C, { "skos:broader": { "@id": A } }),
    ]);
    expect(text).toContain("broader cycle");
  });

  test("related and broader on the same target fails", () => {
    const node = concept(A, {
      "skos:broader": { "@id": B },
      "skos:related": { "@id": B },
    });
    expect(messages([node, concept(B)])).toContain("SKOS S27");
  });

  test("related to a grandparent fails on transitive disjointness", () => {
    // A → B → C, then A related C: direct checks miss this; S27 does not.
    const text = messages([
      concept(A, {
        "skos:broader": { "@id": B },
        "skos:related": { "@id": C },
      }),
      concept(B, { "skos:broader": { "@id": C } }),
      concept(C),
    ]);
    expect(text).toContain("hierarchically above or below");
  });

  test("placement parent is not treated as hierarchy", () => {
    const node = concept(A, {
      "digest:placementParent": { "@id": B },
      "skos:related": { "@id": B },
    });
    expect(violations([node, concept(B)])).toEqual([]);
  });
});

describe("mappings (P1-014F)", () => {
  const FOLIO = "https://folio.openlegalstandard.org/R123";

  test("a local placeholder published as a mapping fails", () => {
    const node = concept(A, {
      "skos:closeMatch": { "@id": "x-digest:evidence-law" },
    });
    expect(messages([node])).toContain("not an absolute HTTP(S) IRI");
  });

  test("exactMatch and broadMatch on the same target fail", () => {
    const node = concept(A, {
      "skos:broadMatch": { "@id": FOLIO },
      "skos:exactMatch": { "@id": FOLIO },
    });
    expect(messages([node])).toContain("SKOS S46");
  });

  test("broadMatch and narrowMatch on the same target fail", () => {
    const node = concept(A, {
      "skos:broadMatch": { "@id": FOLIO },
      "skos:narrowMatch": { "@id": FOLIO },
    });
    expect(messages([node])).toContain("both broadMatch and narrowMatch");
  });

  test("exactMatch plus closeMatch is reported as redundant, not failed", () => {
    const node = concept(A, {
      "skos:closeMatch": { "@id": FOLIO },
      "skos:exactMatch": { "@id": FOLIO },
    });
    expect(violations([node])).toEqual([]);
    expect(messages([node])).toContain("redundant, not contradictory");
  });

  test("a self-mapping fails", () => {
    expect(
      messages([concept(A, { "skos:closeMatch": { "@id": A } })])
    ).toContain("points at the concept itself");
  });
});

describe("scheme and vocabulary", () => {
  test("hasTopConcept without topConceptOf fails", () => {
    const scheme = {
      "@id": SCHEME,
      "@type": "skos:ConceptScheme",
      "skos:hasTopConcept": { "@id": A },
    };
    expect(messages([scheme, concept(A)])).toContain(
      "does not assert skos:topConceptOf"
    );
  });

  test("topConceptOf without hasTopConcept fails", () => {
    const scheme = { "@id": SCHEME, "@type": "skos:ConceptScheme" };
    const node = concept(A, { "skos:topConceptOf": { "@id": SCHEME } });
    expect(messages([scheme, node])).toContain("the scheme does not list it");
  });

  test("agreement in both directions passes", () => {
    const scheme = {
      "@id": SCHEME,
      "@type": "skos:ConceptScheme",
      "skos:hasTopConcept": { "@id": A },
    };
    const node = concept(A, { "skos:topConceptOf": { "@id": SCHEME } });
    expect(violations([scheme, node])).toEqual([]);
  });

  test("an undefined digest: term fails", () => {
    const node = concept(A, { "digest:inventedTerm": "surprise" });
    expect(messages([node])).toContain("not defined in digest-vocab.ttl");
  });
});
