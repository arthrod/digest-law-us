/**
 * SKOS JSON-LD for the American Legal Digest.
 *
 * Concept IRIs come from the identity registry (`concept-ids.ts`), not from
 * the route: `https://w3id.org/digest-law/concept/{id}`. The readable
 * jurisdictional path is an *edition route*, published per concept as
 * `digest:legacyIri` so previously cited IRIs stay discoverable (P1-001,
 * P1-002).
 *
 * What this exporter deliberately does not assert:
 *   - the folder parent is not `skos:broader`. Placement is navigation; a
 *     broader relation is an editorial claim. Structure is published under
 *     `digest:placementParent` / `digest:placementChild` instead (S-02,
 *     P1-006). Measured cost on 2026-07-31: of 1,811 digests, 1,787 carry a
 *     reviewed frontmatter `broader` and only 3 of those differ from the
 *     folder parent, so the published hierarchy survives this on data the
 *     drafter actually asserted.
 *   - historical labels are not `skos:hiddenLabel`. Hidden labels are search
 *     aids; a historical label is a fact about the term's past. They go to
 *     `digest:historicalLabel` (S-04).
 *
 * Relations always carry their IRIs even when the target digest is not yet
 * published: identifiers exist before pages do, and dropping relations would
 * falsify the taxonomy. Publication state is a *rendering* concern.
 *
 * Still PENDING and visible here: `skos:topConceptOf` is still inferred from
 * folder roots (P1-014E wants an editorial decision), and the scheme IRI is
 * still the legacy route base (P1-014A).
 */
import { conceptIriFor, legacyIriFor } from "./concept-ids";
import type { Corpus, TreeNode } from "./corpus";
import {
  CONCEPT_ID_DATATYPE,
  DATATYPE_BASE,
  isBcp47,
  resolveRefIn,
  SCHEME_LANGUAGE,
  SITE_BASE,
  VOCAB_BASE,
  W3ID_BASE,
} from "./iri";
import { humanize } from "./labels";

const CONTEXT = {
  dct: "http://purl.org/dc/terms/",
  digest: VOCAB_BASE,
  foaf: "http://xmlns.com/foaf/0.1/",
  idtype: DATATYPE_BASE,
  skos: "http://www.w3.org/2004/02/skos/core#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

export function conceptIri(slugPath: string): string {
  return conceptIriFor(slugPath).iri;
}

export function pageUrl(slugPath: string): string {
  return `${SITE_BASE}${slugPath}/`;
}

/**
 * Language tag for a concept's literals: the record's own `language` when the
 * corpus carries one, else the scheme's principal language (P1-014I). Only
 * natural-language values get this treatment — identifiers, notations and
 * dates below are typed or bare, never tagged.
 */
function languageOf(fm: Record<string, unknown> | undefined): string {
  const declared = fm?.language;
  return isBcp47(declared) ? declared : SCHEME_LANGUAGE;
}

function langLit(value: string, lang: string) {
  return { "@language": lang, "@value": value };
}

/** Fold for label comparison: SKOS disjointness is not case/space sensitive. */
function foldLabel(value: string): string {
  return value.normalize("NFC").trim().replaceAll(/\s+/gu, " ").toLowerCase();
}

export interface LabelSet {
  prefLabel: string;
  altLabels: string[];
  historicalLabels: string[];
  /** Non-fatal integrity findings, one message each (P1-014B). */
  violations: string[];
}

/**
 * Enforce the SKOS label profile for one concept in one language:
 * at most one `skos:prefLabel`, and preferred/alternate/historical values
 * pairwise disjoint after normalization (P1-014B, S-04).
 *
 * Duplicates are dropped rather than published, and each drop is reported so
 * `bun run ids:check`-style reports and tests can see what the data did.
 */
export function labelSetFor(input: {
  prefLabel: string;
  altLabels?: string[];
  historicalLabels?: string[];
}): LabelSet {
  const violations: string[] = [];
  const prefLabel = input.prefLabel.normalize("NFC").trim();
  const taken = new Map<string, string>([[foldLabel(prefLabel), "prefLabel"]]);

  const keep = (values: string[] | undefined, role: string): string[] => {
    const out: string[] = [];
    for (const raw of values ?? []) {
      const value = raw.normalize("NFC").trim();
      if (!value) {
        continue;
      }
      const folded = foldLabel(value);
      const owner = taken.get(folded);
      if (owner) {
        violations.push(`${role} "${value}" duplicates ${owner}`);
        continue;
      }
      taken.set(folded, role);
      out.push(value);
    }
    return out;
  };

  return {
    altLabels: keep(input.altLabels, "altLabel"),
    historicalLabels: keep(input.historicalLabels, "historicalLabel"),
    prefLabel,
    violations,
  };
}

function iriRefs(urns: string[], corpus: Corpus) {
  return urns.map((urn) => ({
    "@id": conceptIri(resolveRefIn(corpus.nodeBySlugPath, urn).slugPath),
  }));
}

function httpOnly(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.filter(
    (v): v is string => typeof v === "string" && /^https?:\/\//u.test(v)
  );
}

function dateLit(value: string | undefined) {
  if (!value) {
    return;
  }
  const iso = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(iso)) {
    return;
  }
  return { "@type": "xsd:date", "@value": iso };
}

/** Identity block: the minted id, its provenance, and the legacy route IRI. */
function identityOf(node: TreeNode, fm: Record<string, unknown> | undefined) {
  const resolved = conceptIriFor(node.slugPath);
  const block: Record<string, unknown> = {
    "@id": resolved.iri,
    "digest:legacyIri": { "@id": legacyIriFor(node.slugPath) },
  };
  if (resolved.record) {
    // Canonical typed notation is the minted id; the corpus dotted notation
    // is a route artifact and is published as such (P1-014C).
    block["skos:notation"] = {
      "@type": CONCEPT_ID_DATATYPE,
      "@value": resolved.record.id,
    };
    block["dct:identifier"] = resolved.record.uuid;
  }
  const corpusIssueId = resolved.record?.corpusIssueId ?? fm?.issue_id;
  if (typeof corpusIssueId === "string" && corpusIssueId) {
    // Placement-derived UUIDv5 from the runner: provenance, never identity.
    block["digest:corpusIssueId"] = corpusIssueId;
  }
  const pathNotation = fm?.notation ?? resolved.record?.pathNotation;
  if (typeof pathNotation === "string" && pathNotation) {
    block["digest:pathNotation"] = pathNotation;
  }
  return block;
}

/** skos:Concept for one digest (embedded per page and in the scheme dump). */
export function conceptFor(
  corpus: Corpus,
  node: TreeNode,
  opts: { compact?: boolean } = {}
): Record<string, unknown> {
  const { digest } = node;
  const fm = digest?.data as Record<string, unknown> | undefined;
  const isArea = !node.slugPath.includes("/");
  const lang = languageOf(fm);
  const prefSource = fm?.pref_label;
  const labels = labelSetFor({
    altLabels: fm?.alt_labels as string[] | undefined,
    historicalLabels: fm?.historical_labels as string[] | undefined,
    prefLabel:
      typeof prefSource === "string" && prefSource
        ? humanize(prefSource)
        : node.label,
  });

  const concept: Record<string, unknown> = {
    ...identityOf(node, fm),
    "@type": "skos:Concept",
    "skos:inScheme": { "@id": W3ID_BASE },
    "skos:prefLabel": langLit(labels.prefLabel, lang),
  };
  if (isArea) {
    // PENDING P1-014E: still inferred from the folder root, not reviewed.
    concept["skos:topConceptOf"] = { "@id": W3ID_BASE };
  }

  // Hierarchy: only relations the drafter asserted. The folder parent is
  // placement, published separately, and never promoted to skos:broader.
  const broaderIds = new Map<string, { "@id": string }>();
  for (const ref of iriRefs((fm?.broader as string[]) ?? [], corpus)) {
    broaderIds.set(ref["@id"], ref);
  }
  if (broaderIds.size) {
    concept["skos:broader"] = [...broaderIds.values()];
  }

  const narrowerIds = new Map<string, { "@id": string }>();
  for (const ref of iriRefs((fm?.narrower as string[]) ?? [], corpus)) {
    narrowerIds.set(ref["@id"], ref);
  }
  if (narrowerIds.size) {
    concept["skos:narrower"] = [...narrowerIds.values()];
  }

  if (node.slugPath.includes("/")) {
    const parentPath = node.slugPath.split("/").slice(0, -1).join("/");
    concept["digest:placementParent"] = { "@id": conceptIri(parentPath) };
  }
  if (node.children.length) {
    concept["digest:placementChild"] = node.children.map((child) => ({
      "@id": conceptIri(child.slugPath),
    }));
  }

  if (opts.compact) {
    return concept;
  }

  if (labels.altLabels.length) {
    concept["skos:altLabel"] = labels.altLabels.map((v) => langLit(v, lang));
  }
  if (labels.historicalLabels.length) {
    // Not skos:hiddenLabel — see the module note (S-04).
    concept["digest:historicalLabel"] = labels.historicalLabels.map((v) =>
      langLit(v, lang)
    );
  }
  const definition = (fm?.definition as string) || (fm?.description as string);
  if (definition) {
    concept["skos:definition"] = langLit(definition, lang);
  }
  const scopeNotes: { "@language": string; "@value": string }[] = [];
  if (fm?.scope_note) {
    scopeNotes.push(langLit(fm.scope_note as string, lang));
  }
  const doNotUseFor = (fm?.do_not_use_for as string[]) ?? [];
  if (doNotUseFor.length) {
    scopeNotes.push(
      langLit(`Not to be used for: ${doNotUseFor.join("; ")}`, lang)
    );
  }
  if (scopeNotes.length) {
    concept["skos:scopeNote"] = scopeNotes;
  }

  const related = (fm?.related as string[]) ?? [];
  if (related.length) {
    concept["skos:related"] = iriRefs(related, corpus);
  }

  // External mappings (FOLIO, EuroVoc, SALI/LMSS…) — IRIs only.
  const mappings = (fm?.mappings ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const close: string[] = [];
  const relatedMatch: string[] = [];
  const broad: string[] = [];
  for (const group of Object.values(mappings)) {
    if (!group || typeof group !== "object") {
      continue;
    }
    close.push(...httpOnly(group.closeMatch));
    relatedMatch.push(...httpOnly(group.relatedMatch));
    broad.push(...httpOnly(group.broadMatch));
  }
  if (close.length) {
    concept["skos:closeMatch"] = close.map((id) => ({ "@id": id }));
  }
  if (relatedMatch.length) {
    concept["skos:relatedMatch"] = relatedMatch.map((id) => ({ "@id": id }));
  }
  if (broad.length) {
    concept["skos:broadMatch"] = broad.map((id) => ({ "@id": id }));
  }

  const created = dateLit(fm?.created as string | undefined);
  if (created) {
    concept["dct:created"] = created;
  }
  const modified = dateLit(
    (fm?.modified as string | undefined) ??
      (fm?.timestamp as string | undefined)
  );
  if (modified) {
    concept["dct:modified"] = modified;
  }

  if (digest) {
    concept["foaf:page"] = { "@id": pageUrl(node.slugPath) };
  }
  return concept;
}

/** The JSON-LD embedded on a digest page: its concept, contextualised. */
export function conceptJsonLd(corpus: Corpus, node: TreeNode): string {
  return JSON.stringify({ "@context": CONTEXT, ...conceptFor(corpus, node) });
}

/** schema.org Article for a digest page (separate script, plain context). */
export function articleJsonLd(
  node: TreeNode,
  opts: { description: string; dateModified?: string; sourceUrls: string[] }
): string {
  const article: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    about: { "@id": conceptIri(node.slugPath) },
    author: { "@type": "Organization", name: "American Legal Digest" },
    description: opts.description,
    headline: node.label,
    isAccessibleForFree: true,
    isPartOf: {
      "@type": "WebSite",
      name: "American Legal Digest",
      url: SITE_BASE,
    },
    mainEntityOfPage: pageUrl(node.slugPath),
  };
  if (opts.dateModified) {
    const iso = String(opts.dateModified).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/u.test(iso)) {
      article.dateModified = iso;
    }
  }
  if (opts.sourceUrls.length) {
    article.hasPart = opts.sourceUrls.map((url) => ({
      "@type": "ArchiveComponent",
      itemLocation: url,
    }));
  }
  return JSON.stringify(article);
}

/** schema.org ArchiveComponent for a retained-source page. */
export function sourceJsonLd(opts: {
  title: string;
  url: string;
  originUrl: string;
  digestUrl: string;
  retained?: string;
}): string {
  const doc: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ArchiveComponent",
    isPartOf: opts.digestUrl,
    name: opts.title,
    url: opts.url,
  };
  if (opts.originUrl) {
    doc.sameAs = opts.originUrl;
  }
  if (opts.retained) {
    const iso = String(opts.retained).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/u.test(iso)) {
      doc.dateCreated = iso;
    }
  }
  return JSON.stringify(doc);
}

/** Just the ConceptScheme node (small — embedded on the home page). */
export function schemeSummaryJsonLd(corpus: Corpus): string {
  return JSON.stringify({
    "@context": CONTEXT,
    "@id": W3ID_BASE,
    "@type": "skos:ConceptScheme",
    "dct:title": langLit(
      "American Legal Digest — United States",
      SCHEME_LANGUAGE
    ),
    "foaf:homepage": { "@id": SITE_BASE },
    "skos:hasTopConcept": corpus.areas.map((a) => ({
      "@id": conceptIri(a.slugPath),
    })),
  });
}

/** The whole scheme: ConceptScheme + every concept, for /skos.jsonld. */
export function schemeJsonLd(corpus: Corpus): string {
  const graph: Record<string, unknown>[] = [
    {
      "@id": W3ID_BASE,
      "@type": "skos:ConceptScheme",
      "dct:description": langLit(
        "Open, source-grounded digests of United States legal doctrine; " +
          "topic concepts organised jurisdiction-first under w3id.org/digest-law.",
        SCHEME_LANGUAGE
      ),
      "dct:language": SCHEME_LANGUAGE,
      // A publisher name is a name, not natural-language prose: no tag
      // (P1-014I).
      "dct:publisher": "American Legal Digest",
      "dct:title": langLit(
        "American Legal Digest — United States",
        SCHEME_LANGUAGE
      ),
      "foaf:homepage": { "@id": SITE_BASE },
      "skos:hasTopConcept": corpus.areas.map((a) => ({
        "@id": conceptIri(a.slugPath),
      })),
    },
  ];
  const visit = (node: TreeNode) => {
    graph.push(conceptFor(corpus, node, { compact: !node.digest }));
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const area of corpus.areas) {
    visit(area);
  }
  return JSON.stringify({ "@context": CONTEXT, "@graph": graph });
}
