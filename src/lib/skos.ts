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
import { resolveRef, SITE_BASE, W3ID_BASE } from "./corpus";
import { humanize } from "./labels";

const CONTEXT = {
  dct: "http://purl.org/dc/terms/",
  foaf: "http://xmlns.com/foaf/0.1/",
  skos: "http://www.w3.org/2004/02/skos/core#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

export function conceptIri(slugPath: string): string {
  return `${W3ID_BASE}${slugPath}/`;
}

export function pageUrl(slugPath: string): string {
  return `${SITE_BASE}${slugPath}/`;
}

function langLit(value: string) {
  return { "@language": "en", "@value": value };
}

function iriRefs(urns: string[], corpus: Corpus) {
  return urns.map((urn) => ({
    "@id": conceptIri(resolveRef(corpus, urn).slugPath),
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

/** skos:Concept for one digest (embedded per page and in the scheme dump). */
export function conceptFor(
  corpus: Corpus,
  node: TreeNode,
  opts: { compact?: boolean } = {}
): Record<string, unknown> {
  const { digest } = node;
  const fm = digest?.data;
  const isArea = !node.slugPath.includes("/");

  const concept: Record<string, unknown> = {
    "@id": conceptIri(node.slugPath),
    "@type": "skos:Concept",
    "skos:inScheme": { "@id": W3ID_BASE },
    "skos:prefLabel": langLit(
      fm?.pref_label ? humanize(fm.pref_label) : node.label
    ),
  };
  if (isArea) {
    concept["skos:topConceptOf"] = { "@id": W3ID_BASE };
  }

  if (fm?.notation) {
    concept["skos:notation"] = fm.notation;
  }

  // Hierarchy: frontmatter broader plus the structural parent; narrower is
  // the union of frontmatter narrower and actual children. Dedup by IRI.
  const broaderUrns = fm?.broader ?? [];
  const broaderIds = new Map<string, { "@id": string }>();
  for (const ref of iriRefs(broaderUrns, corpus)) {
    broaderIds.set(ref["@id"], ref);
  }
  if (node.slugPath.includes("/")) {
    const parentPath = node.slugPath.split("/").slice(0, -1).join("/");
    broaderIds.set(conceptIri(parentPath), { "@id": conceptIri(parentPath) });
  }
  if (broaderIds.size) {
    concept["skos:broader"] = [...broaderIds.values()];
  }

  const narrowerIds = new Map<string, { "@id": string }>();
  for (const ref of iriRefs(fm?.narrower ?? [], corpus)) {
    narrowerIds.set(ref["@id"], ref);
  }
  for (const child of node.children) {
    narrowerIds.set(conceptIri(child.slugPath), {
      "@id": conceptIri(child.slugPath),
    });
  }
  if (narrowerIds.size) {
    concept["skos:narrower"] = [...narrowerIds.values()];
  }

  if (opts.compact) {
    return concept;
  }

  if (fm?.alt_labels?.length) {
    concept["skos:altLabel"] = fm.alt_labels.map(langLit);
  }
  if (fm?.historical_labels?.length) {
    concept["skos:hiddenLabel"] = fm.historical_labels.map(langLit);
  }
  const definition = fm?.definition ?? fm?.description;
  if (definition) {
    concept["skos:definition"] = langLit(definition);
  }
  const scopeNotes: ReturnType<typeof langLit>[] = [];
  if (fm?.scope_note) {
    scopeNotes.push(langLit(fm.scope_note));
  }
  if (fm?.do_not_use_for?.length) {
    scopeNotes.push(
      langLit(`Not to be used for: ${fm.do_not_use_for.join("; ")}`)
    );
  }
  if (scopeNotes.length) {
    concept["skos:scopeNote"] = scopeNotes;
  }

  if (fm?.related?.length) {
    concept["skos:related"] = iriRefs(fm.related, corpus);
  }

  // External mappings (FOLIO, EuroVoc, SALI/LMSS…) — IRIs only.
  const mappings = (fm?.mappings ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const close: string[] = [];
  const related: string[] = [];
  const broad: string[] = [];
  for (const group of Object.values(mappings)) {
    if (!group || typeof group !== "object") {
      continue;
    }
    close.push(...httpOnly(group.closeMatch));
    related.push(...httpOnly(group.relatedMatch));
    broad.push(...httpOnly(group.broadMatch));
  }
  if (close.length) {
    concept["skos:closeMatch"] = close.map((id) => ({ "@id": id }));
  }
  if (related.length) {
    concept["skos:relatedMatch"] = related.map((id) => ({ "@id": id }));
  }
  if (broad.length) {
    concept["skos:broadMatch"] = broad.map((id) => ({ "@id": id }));
  }

  const created = dateLit(fm?.created);
  if (created) {
    concept["dct:created"] = created;
  }
  const modified = dateLit(fm?.modified ?? fm?.timestamp);
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
    "dct:title": langLit("American Legal Digest — United States"),
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
          "topic concepts organised jurisdiction-first under w3id.org/digest-law."
      ),
      "dct:publisher": langLit("American Legal Digest"),
      "dct:title": langLit("American Legal Digest — United States"),
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
