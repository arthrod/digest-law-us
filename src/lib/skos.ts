/**
 * SKOS JSON-LD for the American Legal Digest.
 *
 * Concept IRIs are the permanent w3id identifiers
 * (https://w3id.org/digest-law/us/{path}/) — minted once, stable across
 * hosting moves. Relations always carry their IRIs even when the target
 * digest is not yet published: identifiers exist before pages do, and
 * dropping relations would falsify the taxonomy. Publication state is a
 * *rendering* concern (resolved chip vs muted chip), not a data concern.
 */
import type { Corpus, TreeNode } from "./corpus";
import { W3ID_BASE, SITE_BASE, resolveRef } from "./corpus";
import { humanize } from "./labels";

const CONTEXT = {
  skos: "http://www.w3.org/2004/02/skos/core#",
  dct: "http://purl.org/dc/terms/",
  foaf: "http://xmlns.com/foaf/0.1/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

export function conceptIri(slugPath: string): string {
  return `${W3ID_BASE}${slugPath}/`;
}

export function pageUrl(slugPath: string): string {
  return `${SITE_BASE}${slugPath}/`;
}

function langLit(value: string) {
  return { "@value": value, "@language": "en" };
}

function iriRefs(urns: string[], corpus: Corpus) {
<<<<<<< HEAD
  return urns.map(urn => ({ "@id": conceptIri(resolveRef(corpus, urn).slugPath) }));
=======
  return urns.map((urn) => ({ "@id": conceptIri(resolveRef(corpus, urn).slugPath) }));
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
}

function httpOnly(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
<<<<<<< HEAD
  return values.filter(
    (v): v is string => typeof v === "string" && /^https?:\/\//.test(v)
  );
=======
  return values.filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
}

function dateLit(value: string | undefined) {
  if (!value) return undefined;
  const iso = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return { "@value": iso, "@type": "xsd:date" };
}

/** skos:Concept for one digest (embedded per page and in the scheme dump). */
export function conceptFor(
  corpus: Corpus,
  node: TreeNode,
<<<<<<< HEAD
  opts: { compact?: boolean } = {}
=======
  opts: { compact?: boolean } = {},
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
): Record<string, unknown> {
  const digest = node.digest;
  const fm = digest?.data;
  const isArea = !node.slugPath.includes("/");

  const concept: Record<string, unknown> = {
    "@id": conceptIri(node.slugPath),
    "@type": "skos:Concept",
<<<<<<< HEAD
    "skos:prefLabel": langLit(
      fm?.pref_label ? humanize(fm.pref_label) : node.label
    ),
=======
    "skos:prefLabel": langLit(fm?.pref_label ? humanize(fm.pref_label) : node.label),
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
    "skos:inScheme": { "@id": W3ID_BASE },
  };
  if (isArea) concept["skos:topConceptOf"] = { "@id": W3ID_BASE };

  if (fm?.notation) concept["skos:notation"] = fm.notation;

  // Hierarchy: frontmatter broader plus the structural parent; narrower is
  // the union of frontmatter narrower and actual children. Dedup by IRI.
  const broaderUrns = fm?.broader ?? [];
  const broaderIds = new Map<string, { "@id": string }>();
  for (const ref of iriRefs(broaderUrns, corpus)) broaderIds.set(ref["@id"], ref);
  if (node.slugPath.includes("/")) {
    const parentPath = node.slugPath.split("/").slice(0, -1).join("/");
    broaderIds.set(conceptIri(parentPath), { "@id": conceptIri(parentPath) });
  }
  if (broaderIds.size) concept["skos:broader"] = [...broaderIds.values()];

  const narrowerIds = new Map<string, { "@id": string }>();
<<<<<<< HEAD
  for (const ref of iriRefs(fm?.narrower ?? [], corpus))
    narrowerIds.set(ref["@id"], ref);
=======
  for (const ref of iriRefs(fm?.narrower ?? [], corpus)) narrowerIds.set(ref["@id"], ref);
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
  for (const child of node.children)
    narrowerIds.set(conceptIri(child.slugPath), {
      "@id": conceptIri(child.slugPath),
    });
  if (narrowerIds.size) concept["skos:narrower"] = [...narrowerIds.values()];

  if (opts.compact) return concept;

<<<<<<< HEAD
  if (fm?.alt_labels?.length)
    concept["skos:altLabel"] = fm.alt_labels.map(langLit);
=======
  if (fm?.alt_labels?.length) concept["skos:altLabel"] = fm.alt_labels.map(langLit);
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
  if (fm?.historical_labels?.length)
    concept["skos:hiddenLabel"] = fm.historical_labels.map(langLit);
  const definition = fm?.definition || fm?.description;
  if (definition) concept["skos:definition"] = langLit(definition);
  const scopeNotes: ReturnType<typeof langLit>[] = [];
  if (fm?.scope_note) scopeNotes.push(langLit(fm.scope_note));
  if (fm?.do_not_use_for?.length)
    scopeNotes.push(langLit(`Not to be used for: ${fm.do_not_use_for.join("; ")}`));
  if (scopeNotes.length) concept["skos:scopeNote"] = scopeNotes;

  if (fm?.related?.length) concept["skos:related"] = iriRefs(fm.related, corpus);

  // External mappings (FOLIO, EuroVoc, SALI/LMSS…) — IRIs only.
<<<<<<< HEAD
  const mappings = (fm?.mappings ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
=======
  const mappings = (fm?.mappings ?? {}) as Record<string, Record<string, unknown>>;
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
  const close: string[] = [];
  const related: string[] = [];
  const broad: string[] = [];
  for (const group of Object.values(mappings)) {
    if (!group || typeof group !== "object") continue;
    close.push(...httpOnly(group.closeMatch));
    related.push(...httpOnly(group.relatedMatch));
    broad.push(...httpOnly(group.broadMatch));
  }
<<<<<<< HEAD
  if (close.length) concept["skos:closeMatch"] = close.map(id => ({ "@id": id }));
  if (related.length)
    concept["skos:relatedMatch"] = related.map(id => ({ "@id": id }));
  if (broad.length) concept["skos:broadMatch"] = broad.map(id => ({ "@id": id }));
=======
  if (close.length) concept["skos:closeMatch"] = close.map((id) => ({ "@id": id }));
  if (related.length) concept["skos:relatedMatch"] = related.map((id) => ({ "@id": id }));
  if (broad.length) concept["skos:broadMatch"] = broad.map((id) => ({ "@id": id }));
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

  const created = dateLit(fm?.created);
  if (created) concept["dct:created"] = created;
  const modified = dateLit(fm?.modified ?? fm?.timestamp);
  if (modified) concept["dct:modified"] = modified;

  if (digest) concept["foaf:page"] = { "@id": pageUrl(node.slugPath) };
  return concept;
}

/** The JSON-LD embedded on a digest page: its concept, contextualised. */
export function conceptJsonLd(corpus: Corpus, node: TreeNode): string {
  return JSON.stringify({ "@context": CONTEXT, ...conceptFor(corpus, node) });
}

/** schema.org Article for a digest page (separate script, plain context). */
export function articleJsonLd(
  node: TreeNode,
<<<<<<< HEAD
  opts: { description: string; dateModified?: string; sourceUrls: string[] }
=======
  opts: { description: string; dateModified?: string; sourceUrls: string[] },
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
): string {
  const article: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: node.label,
    description: opts.description,
    mainEntityOfPage: pageUrl(node.slugPath),
    about: { "@id": conceptIri(node.slugPath) },
    isPartOf: {
      "@type": "WebSite",
      name: "American Legal Digest",
      url: SITE_BASE,
    },
    isAccessibleForFree: true,
    author: { "@type": "Organization", name: "American Legal Digest" },
  };
  if (opts.dateModified) {
    const iso = String(opts.dateModified).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) article.dateModified = iso;
  }
  if (opts.sourceUrls.length) {
<<<<<<< HEAD
    article.hasPart = opts.sourceUrls.map(url => ({
=======
    article.hasPart = opts.sourceUrls.map((url) => ({
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
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
    name: opts.title,
    url: opts.url,
    isPartOf: opts.digestUrl,
  };
  if (opts.originUrl) doc.sameAs = opts.originUrl;
  if (opts.retained) {
    const iso = String(opts.retained).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) doc.dateCreated = iso;
  }
  return JSON.stringify(doc);
}

/** Just the ConceptScheme node (small — embedded on the home page). */
export function schemeSummaryJsonLd(corpus: Corpus): string {
  return JSON.stringify({
    "@context": CONTEXT,
    "@id": W3ID_BASE,
    "@type": "skos:ConceptScheme",
    "dct:title": langLit("American Legal Digest — United States"),
    "foaf:homepage": { "@id": SITE_BASE },
<<<<<<< HEAD
    "skos:hasTopConcept": corpus.areas.map(a => ({
=======
    "skos:hasTopConcept": corpus.areas.map((a) => ({
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
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
      "dct:title": langLit("American Legal Digest — United States"),
      "dct:description": langLit(
        "Open, source-grounded digests of United States legal doctrine; " +
<<<<<<< HEAD
          "topic concepts organised jurisdiction-first under w3id.org/digest-law."
      ),
      "dct:publisher": langLit("American Legal Digest"),
      "foaf:homepage": { "@id": SITE_BASE },
      "skos:hasTopConcept": corpus.areas.map(a => ({
=======
          "topic concepts organised jurisdiction-first under w3id.org/digest-law.",
      ),
      "dct:publisher": langLit("American Legal Digest"),
      "foaf:homepage": { "@id": SITE_BASE },
      "skos:hasTopConcept": corpus.areas.map((a) => ({
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
        "@id": conceptIri(a.slugPath),
      })),
    },
  ];
  const visit = (node: TreeNode) => {
    graph.push(conceptFor(corpus, node, { compact: !node.digest }));
    node.children.forEach(visit);
  };
  corpus.areas.forEach(visit);
  return JSON.stringify({ "@context": CONTEXT, "@graph": graph });
}
