/**
 * Release validation for the published SKOS graph (P1-014B/C/D/E/F).
 *
 * This is the executable half of `public/profile/digest-skos-shapes.ttl`. The
 * shapes are the specification; this implements them, including the graph-wide
 * constraints plain SHACL core cannot state (cycle freedom, notation
 * uniqueness, transitive related/broader disjointness). No SHACL engine runs
 * over releases yet — R7-002 — so if the two disagree, the shapes are right
 * and this is the defect.
 *
 * Input is the `@graph` array of /skos.jsonld, so it validates what is
 * actually published rather than what the exporter intended.
 */

import { CONCEPT_BASE, VOCAB_BASE, W3ID_BASE } from "./iri";

export interface Violation {
  /** Shape constraint this belongs to, for cross-referencing the .ttl */
  constraint: string;
  /** The offending node's @id, or the scheme IRI for graph-wide findings */
  node: string;
  message: string;
  /** advisory findings do not fail a release; violations do */
  severity: "violation" | "warning";
}

type Node = Record<string, unknown>;

const CONCEPT_ID_DATATYPE_SUFFIX = "datatype/concept-id",
 HEX32 = /^[0-9a-f]{32}$/u,
 DASHED_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
 ABSOLUTE_HTTP = /^https?:\/\//u;

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** IRIs referenced by a relation property, whatever its cardinality. */
function refs(node: Node, key: string): string[] {
  return asArray(node[key])
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object") {
        const id = (entry as Record<string, unknown>)["@id"];
        return typeof id === "string" ? id : "";
      }
      return "";
    })
    .filter(Boolean);
}

interface Literal {
  value: string;
  language?: string;
  datatype?: string;
}

function literals(node: Node, key: string): Literal[] {
  return asArray(node[key]).map((entry) => {
    if (typeof entry === "string") {
      return { value: entry };
    }
    const object = (entry ?? {}) as Record<string, unknown>;
    return {
      datatype:
        typeof object["@type"] === "string" ? object["@type"] : undefined,
      language:
        typeof object["@language"] === "string"
          ? object["@language"]
          : undefined,
      value: String(object["@value"] ?? ""),
    };
  });
}

function foldLabel(value: string): string {
  return value.normalize("NFC").trim().replaceAll(/\s+/gu, " ").toLowerCase();
}

function isConcept(node: Node): boolean {
  return asArray(node["@type"]).includes("skos:Concept");
}

function isScheme(node: Node): boolean {
  return asArray(node["@type"]).includes("skos:ConceptScheme");
}

function idOf(node: Node): string {
  return typeof node["@id"] === "string" ? node["@id"] : "";
}

/** Labels: one prefLabel per language, sets pairwise disjoint (P1-014B). */
function checkLabels(node: Node, out: Violation[]): void {
  const id = idOf(node),
   prefs = literals(node, "skos:prefLabel");
  if (prefs.length === 0) {
    out.push({
      constraint: "ConceptShape/skos:prefLabel minCount",
      message: "concept has no skos:prefLabel",
      node: id,
      severity: "violation",
    });
  }
  const byLang = new Map<string, number>();
  for (const label of prefs) {
    const lang = label.language ?? "";
    if (!lang) {
      out.push({
        constraint: "ConceptShape/skos:prefLabel nodeKind",
        message: `prefLabel "${label.value}" carries no language tag`,
        node: id,
        severity: "violation",
      });
    }
    byLang.set(lang, (byLang.get(lang) ?? 0) + 1);
  }
  for (const [lang, count] of byLang) {
    if (count > 1) {
      out.push({
        constraint: "ConceptShape/skos:prefLabel uniqueLang",
        message: `${count} preferred labels for language "${lang}" (SKOS S14 allows one)`,
        node: id,
        severity: "violation",
      });
    }
  }

  if (node["skos:hiddenLabel"] !== undefined) {
    out.push({
      constraint: "ConceptShape/skos:hiddenLabel maxCount 0",
      message:
        "skos:hiddenLabel is not published by this project — historical labels belong in digest:historicalLabel",
      node: id,
      severity: "violation",
    });
  }

  // Disjointness is per language, on normalized values.
  const owner = new Map<string, string>(),
   claim = (label: Literal, role: string) => {
    const key = `${label.language ?? ""}\u0000${foldLabel(label.value)}`,
     held = owner.get(key);
    if (held && held !== role) {
      out.push({
        constraint: "ConceptShape label disjointness",
        message: `"${label.value}" appears as both ${held} and ${role}`,
        node: id,
        severity: "violation",
      });
      return;
    }
    if (held === role) {
      out.push({
        constraint: "ConceptShape label disjointness",
        message: `"${label.value}" is repeated within ${role}`,
        node: id,
        severity: "violation",
      });
      return;
    }
    owner.set(key, role);
  };
  for (const label of prefs) {
    claim(label, "prefLabel");
  }
  for (const label of literals(node, "skos:altLabel")) {
    claim(label, "altLabel");
  }
  for (const label of literals(node, "digest:historicalLabel")) {
    claim(label, "historicalLabel");
  }
}

/** Identity: typed notation, matching identifier, untagged provenance. */
function checkIdentity(node: Node, out: Violation[]): void {
  const id = idOf(node);
  if (!(id.startsWith(CONCEPT_BASE) || id.startsWith(W3ID_BASE))) {
    out.push({
      constraint: "ConceptShape identity",
      message: `@id is outside the project namespaces: ${id}`,
      node: id,
      severity: "violation",
    });
  }
  if (id.startsWith(W3ID_BASE) && !id.startsWith(CONCEPT_BASE)) {
    out.push({
      constraint: "ConceptShape identity",
      message:
        "concept still published under a route-derived IRI — it has no minted id (run `bun run ids:mint`)",
      node: id,
      severity: "warning",
    });
    return; // unminted concepts carry no notation by design
  }

  const notations = literals(node, "skos:notation");
  if (notations.length !== 1) {
    out.push({
      constraint: "ConceptShape/skos:notation maxCount",
      message: `expected exactly one canonical notation, found ${notations.length}`,
      node: id,
      severity: "violation",
    });
  }
  for (const notation of notations) {
    if (!notation.datatype?.endsWith(CONCEPT_ID_DATATYPE_SUFFIX)) {
      out.push({
        constraint: "ConceptShape/skos:notation datatype",
        message: `notation "${notation.value}" is not typed idtype:concept-id`,
        node: id,
        severity: "violation",
      });
    }
    if (!HEX32.test(notation.value)) {
      out.push({
        constraint: "ConceptShape/skos:notation pattern",
        message: `notation "${notation.value}" is not 32 lowercase hex`,
        node: id,
        severity: "violation",
      });
    }
    if (!id.endsWith(notation.value)) {
      out.push({
        constraint: "ConceptShape identity",
        message: "notation does not match the concept IRI",
        node: id,
        severity: "violation",
      });
    }
  }

  for (const identifier of literals(node, "dct:identifier")) {
    if (!DASHED_UUID.test(identifier.value)) {
      out.push({
        constraint: "ConceptShape/dct:identifier pattern",
        message: `identifier "${identifier.value}" is not a dashed UUID`,
        node: id,
        severity: "violation",
      });
    }
    if (identifier.language) {
      out.push({
        constraint: "ConceptShape/dct:identifier nodeKind",
        message: "identifiers must not carry a language tag",
        node: id,
        severity: "violation",
      });
    }
  }

  for (const key of ["digest:corpusIssueId", "digest:pathNotation"]) {
    for (const value of literals(node, key)) {
      if (value.language) {
        out.push({
          constraint: "ConceptShape non-language literals",
          message: `${key} must not carry a language tag`,
          node: id,
          severity: "violation",
        });
      }
    }
  }
}

/** Per-node hierarchy and mapping constraints (P1-014D, P1-014F). */
function checkRelations(node: Node, out: Violation[]): void {
  const id = idOf(node),
   broader = new Set(refs(node, "skos:broader")),
   narrower = new Set(refs(node, "skos:narrower")),
   related = new Set(refs(node, "skos:related"));

  for (const [key, set] of [
    ["skos:broader", broader],
    ["skos:narrower", narrower],
    ["skos:related", related],
  ] as const) {
    if (set.has(id)) {
      out.push({
        constraint: "ConceptShape hierarchy",
        message: `concept is its own ${key}`,
        node: id,
        severity: "violation",
      });
    }
  }
  for (const target of related) {
    if (broader.has(target) || narrower.has(target)) {
      out.push({
        constraint: "ConceptShape/skos:related disjoint",
        message: `${target} is asserted as both related and hierarchical (SKOS S27)`,
        node: id,
        severity: "violation",
      });
    }
  }
  for (const target of broader) {
    if (narrower.has(target)) {
      out.push({
        constraint: "ConceptShape hierarchy",
        message: `${target} is asserted as both broader and narrower`,
        node: id,
        severity: "violation",
      });
    }
  }

  const mappings = {
    "skos:broadMatch": refs(node, "skos:broadMatch"),
    "skos:closeMatch": refs(node, "skos:closeMatch"),
    "skos:exactMatch": refs(node, "skos:exactMatch"),
    "skos:narrowMatch": refs(node, "skos:narrowMatch"),
    "skos:relatedMatch": refs(node, "skos:relatedMatch"),
  };
  for (const [key, targets] of Object.entries(mappings)) {
    for (const target of targets) {
      if (!ABSOLUTE_HTTP.test(target)) {
        out.push({
          constraint: "ConceptShape mapping pattern",
          message: `${key} target "${target}" is not an absolute HTTP(S) IRI`,
          node: id,
          severity: "violation",
        });
      }
      if (target === id) {
        out.push({
          constraint: "ConceptShape mapping",
          message: `${key} points at the concept itself`,
          node: id,
          severity: "violation",
        });
      }
    }
  }
  const exact = new Set(mappings["skos:exactMatch"]),
   broad = new Set(mappings["skos:broadMatch"]),
   narrow = new Set(mappings["skos:narrowMatch"]);
  for (const target of exact) {
    if (broad.has(target) || narrow.has(target)) {
      out.push({
        constraint: "ConceptShape/skos:exactMatch disjoint",
        message: `${target} is both exactMatch and a hierarchical match (SKOS S46)`,
        node: id,
        severity: "violation",
      });
    }
    if (mappings["skos:relatedMatch"].includes(target)) {
      out.push({
        constraint: "ConceptShape/skos:exactMatch disjoint",
        message: `${target} is both exactMatch and relatedMatch (SKOS S46)`,
        node: id,
        severity: "violation",
      });
    }
    if (mappings["skos:closeMatch"].includes(target)) {
      out.push({
        constraint: "ConceptShape mapping redundancy",
        message: `${target} is asserted as both exactMatch and closeMatch — redundant, not contradictory`,
        node: id,
        severity: "warning",
      });
    }
  }
  for (const target of broad) {
    if (narrow.has(target)) {
      out.push({
        constraint: "ConceptShape mapping",
        message: `${target} is both broadMatch and narrowMatch`,
        node: id,
        severity: "violation",
      });
    }
  }
}

/** Graph-wide: notation uniqueness, cycles, transitive related, top concepts. */
function checkGraph(concepts: Node[], schemes: Node[], out: Violation[]): void {
  const notationOwner = new Map<string, string>();
  for (const node of concepts) {
    for (const notation of literals(node, "skos:notation")) {
      const held = notationOwner.get(notation.value);
      if (held) {
        out.push({
          constraint: "ConceptShape notation uniqueness",
          message: `notation "${notation.value}" is also used by ${held}`,
          node: idOf(node),
          severity: "violation",
        });
      }
      notationOwner.set(notation.value, idOf(node));
    }
  }

  const broaderOf = new Map<string, string[]>();
  for (const node of concepts) {
    broaderOf.set(idOf(node), refs(node, "skos:broader"));
  }

  // Cycle detection over the asserted broader graph.
  const state = new Map<string, 0 | 1 | 2>(),
   reported = new Set<string>(),
   walk = (id: string, trail: string[]): void => {
    if (state.get(id) === 2) {
      return;
    }
    if (state.get(id) === 1) {
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(" → ");
      if (!reported.has(cycle)) {
        reported.add(cycle);
        out.push({
          constraint: "ConceptShape hierarchy acyclicity",
          message: `broader cycle: ${cycle}`,
          node: id,
          severity: "violation",
        });
      }
      return;
    }
    state.set(id, 1);
    for (const parent of broaderOf.get(id) ?? []) {
      walk(parent, [...trail, id]);
    }
    state.set(id, 2);
  };
  for (const id of broaderOf.keys()) {
    walk(id, []);
  }

  // skos:related must be disjoint from skos:broaderTransitive (SKOS S27),
  // not merely from the direct broader assertions checked per node.
  const ancestorsOf = (id: string, seen = new Set<string>()): Set<string> => {
    for (const parent of broaderOf.get(id) ?? []) {
      if (!seen.has(parent)) {
        seen.add(parent);
        ancestorsOf(parent, seen);
      }
    }
    return seen;
  };
  for (const node of concepts) {
    const id = idOf(node),
     related = refs(node, "skos:related");
    if (related.length === 0) {
      continue;
    }
    const ancestors = ancestorsOf(id),
     descendants = new Set<string>();
    for (const [child, parents] of broaderOf) {
      if (ancestorsOf(child).has(id) || parents.includes(id)) {
        descendants.add(child);
      }
    }
    for (const target of related) {
      if (ancestors.has(target) || descendants.has(target)) {
        out.push({
          constraint: "ConceptShape/skos:related transitive disjointness",
          message: `${target} is related to a concept it is also hierarchically above or below (SKOS S27)`,
          node: id,
          severity: "violation",
        });
      }
    }
  }

  // hasTopConcept ↔ topConceptOf must agree in both directions (P1-014E).
  for (const scheme of schemes) {
    const schemeId = idOf(scheme),
     declared = new Set(refs(scheme, "skos:hasTopConcept")),
     claiming = new Set(
      concepts
        .filter((node) => refs(node, "skos:topConceptOf").includes(schemeId))
        .map(idOf)
    );
    for (const top of declared) {
      if (!claiming.has(top)) {
        out.push({
          constraint: "ConceptSchemeShape top-concept agreement",
          message: `${top} is a declared top concept but does not assert skos:topConceptOf`,
          node: schemeId,
          severity: "violation",
        });
      }
    }
    for (const top of claiming) {
      if (!declared.has(top)) {
        out.push({
          constraint: "ConceptSchemeShape top-concept agreement",
          message: `${top} asserts skos:topConceptOf but the scheme does not list it`,
          node: schemeId,
          severity: "violation",
        });
      }
    }
  }
}

/** Every published concept must sit in the project's vocabulary namespaces. */
function checkVocabulary(node: Node, out: Violation[]): void {
  for (const key of Object.keys(node)) {
    if (!key.startsWith("digest:")) {
      continue;
    }
    const term = key.slice("digest:".length),
     known = [
      "corpusIssueId",
      "historicalLabel",
      "legacyIri",
      "pathNotation",
      "placementChild",
      "placementParent",
    ];
    if (!known.includes(term)) {
      out.push({
        constraint: "project vocabulary",
        message: `${VOCAB_BASE}${term} is used but not defined in digest-vocab.ttl`,
        node: idOf(node),
        severity: "violation",
      });
    }
  }
}

/**
 * Validate a published SKOS JSON-LD document.
 *
 * Accepts the parsed `/skos.jsonld` object (or a bare `@graph` array) and
 * returns every finding. Callers decide policy; `bun run skos:check` fails on
 * any `violation` and reports `warning`s without failing.
 */
export function validateSkosGraph(document: unknown): Violation[] {
  const graph = Array.isArray(document)
    ? document
    : asArray((document as Node | null)?.["@graph"]),
   nodes = graph.filter(
    (node): node is Node => Boolean(node) && typeof node === "object"
  ),
   concepts = nodes.filter(isConcept),
   schemes = nodes.filter(isScheme),

   out: Violation[] = [];
  if (concepts.length === 0) {
    out.push({
      constraint: "graph",
      message: "no skos:Concept nodes found — is this a SKOS release graph?",
      node: "",
      severity: "violation",
    });
    return out;
  }
  for (const node of concepts) {
    checkIdentity(node, out);
    checkLabels(node, out);
    checkRelations(node, out);
    checkVocabulary(node, out);
  }
  checkGraph(concepts, schemes, out);
  return out;
}
