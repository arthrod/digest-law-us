/**
 * Corpus graph, derived once per build from the content collections.
 *
 * Everything downstream — routes, breadcrumbs, route-scoped trees, SKOS
 * resolution — reads from here. Navigation data is handed out per route
 * scope only (hard constraint 1): digest pages get breadcrumbs + rail,
 * area/container pages get their own subtree, and the full map exists on
 * the home page and /sitemap/ alone.
 */

import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

import type { ResolvedRef } from "./iri";
import { resolveRefIn } from "./iri";
import { humanize, slugSegment } from "./labels";

export type Digest = CollectionEntry<"digests">;
export type SourceMeta = CollectionEntry<"sources">;
export type AuditEntry = CollectionEntry<"audits">;
export type IndexEntry =
  | CollectionEntry<"caselaw">
  | CollectionEntry<"statutory">;
export type RunEntry = CollectionEntry<"runs">;

export interface TreeNode {
  children: TreeNode[];
  digest?: Digest;
  dir: string;
  label: string;
  /** latest generation timestamp at or below (ISO) */
  latest: string;
  /** deepest nesting below this node (0 = leaf) */
  maxDepth: number;
  segment: string;
  slugPath: string;
  /** retained sources held at or below */
  sourceCount: number;
  /** published digests at or below this node */
  topicCount: number;
}

export interface Corpus {
  areas: TreeNode[];
  auditsByDir: Map<string, AuditEntry>;
  byDir: Map<string, Digest>;
  caselawByDir: Map<string, IndexEntry>;
  compositeAreas: TreeNode[];
  digests: Digest[];
  doctrinalAreas: TreeNode[];
  nodeBySlugPath: Map<string, TreeNode>;
  runsByDir: Map<string, RunEntry>;
  sourcesByBundle: Map<string, SourceMeta[]>;
  stats: {
    digests: number;
    areas: number;
    sources: number;
    sourceBytes: number;
    preProvenance: number;
    latest: string;
  };
  statutoryByDir: Map<string, IndexEntry>;
}

function parentDir(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}

let corpusPromise: Promise<Corpus> | null = null;

async function build(): Promise<Corpus> {
  const [rawDigests, auditsCol, caselawCol, statutoryCol, runsCol, sourcesCol] =
    await Promise.all([
      getCollection("digests"),
      getCollection("audits"),
      getCollection("caselaw"),
      getCollection("statutory"),
      getCollection("runs"),
      getCollection("sources"),
    ]);

  // A digest is the .md named after its own bundle directory. Anything else
  // that slipped through the glob is logged and dropped, never silently.
  const digests: Digest[] = [];
  for (const entry of rawDigests) {
    const segs = entry.id.split("/");
    if (segs.length >= 2 && segs.at(-1) === segs.at(-2)) {
      digests.push(entry);
    } else {
      console.warn(`[corpus] skipping non-digest markdown: ${entry.id}`);
    }
  }

  const byDir = new Map<string, Digest>();
  for (const d of digests) {
    byDir.set(parentDir(d.id), d);
  }

  const auditsByDir = new Map<string, AuditEntry>();
  for (const a of auditsCol) {
    auditsByDir.set(parentDir(a.id), a);
  }
  const caselawByDir = new Map<string, IndexEntry>();
  for (const c of caselawCol) {
    caselawByDir.set(parentDir(c.id), c);
  }
  const statutoryByDir = new Map<string, IndexEntry>();
  for (const s of statutoryCol) {
    statutoryByDir.set(parentDir(s.id), s);
  }
  const runsByDir = new Map<string, RunEntry>();
  for (const r of runsCol) {
    runsByDir.set(parentDir(r.id), r);
  }

  const sourcesByBundle = new Map<string, SourceMeta[]>();
  for (const s of sourcesCol) {
    const list = sourcesByBundle.get(s.data.bundle) ?? [];
    list.push(s);
    sourcesByBundle.set(s.data.bundle, list);
  }
  for (const list of sourcesByBundle.values()) {
    list.sort((a, b) => a.data.slug.localeCompare(b.data.slug));
  }

  // ---- Tree ----
  const nodeByDir = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  function ensureNode(dir: string): TreeNode {
    const existing = nodeByDir.get(dir);
    if (existing) {
      return existing;
    }
    const segs = dir.split("/");
    const segment = segs.at(-1);
    const node: TreeNode = {
      children: [],
      dir,
      label: humanize(segment),
      latest: "",
      maxDepth: 0,
      segment,
      slugPath: segs.map(slugSegment).join("/"),
      sourceCount: 0,
      topicCount: 0,
    };
    nodeByDir.set(dir, node);
    if (segs.length === 1) {
      roots.push(node);
    } else {
      ensureNode(segs.slice(0, -1).join("/")).children.push(node);
    }
    return node;
  }

  for (const dir of byDir.keys()) {
    ensureNode(dir).digest = byDir.get(dir);
  }

  function aggregate(node: TreeNode): void {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    let topics = node.digest ? 1 : 0;
    let depth = 0;
    let sources = node.digest
      ? (sourcesByBundle.get(node.dir)?.length ?? 0)
      : 0;
    let latest = node.digest?.data.timestamp ?? "";
    for (const child of node.children) {
      aggregate(child);
      topics += child.topicCount;
      depth = Math.max(depth, child.maxDepth + 1);
      sources += child.sourceCount;
      if (child.latest > latest) {
        ({ latest } = child);
      }
    }
    node.topicCount = topics;
    node.maxDepth = depth;
    node.sourceCount = sources;
    node.latest = latest;
  }
  for (const root of roots) {
    aggregate(root);
  }
  roots.sort((a, b) => a.label.localeCompare(b.label));

  const nodeBySlugPath = new Map<string, TreeNode>();
  for (const node of nodeByDir.values()) {
    nodeBySlugPath.set(node.slugPath, node);
  }

  const doctrinalAreas = roots.filter(
    (r) => r.segment !== r.segment.toUpperCase()
  );
  const compositeAreas = roots.filter(
    (r) => r.segment === r.segment.toUpperCase()
  );

  let sourceBytes = 0;
  let sourceCount = 0;
  for (const list of sourcesByBundle.values()) {
    for (const s of list) {
      sourceBytes += s.data.bytes;
      sourceCount += 1;
    }
  }
  let preProvenance = 0;
  for (const dir of byDir.keys()) {
    if (!runsByDir.has(dir)) {
      preProvenance += 1;
    }
  }
  let latest = "";
  for (const root of roots) {
    if (root.latest > latest) {
      ({ latest } = root);
    }
  }

  return {
    areas: roots,
    auditsByDir,
    byDir,
    caselawByDir,
    compositeAreas,
    digests,
    doctrinalAreas,
    nodeBySlugPath,
    runsByDir,
    sourcesByBundle,
    stats: {
      areas: roots.length,
      digests: digests.length,
      latest,
      preProvenance,
      sourceBytes,
      sources: sourceCount,
    },
    statutoryByDir,
  };
}

export function getCorpus(): Promise<Corpus> {
  corpusPromise ??= build();
  return corpusPromise;
}

// ---- SKOS URN resolution ----
// The namespaces and the pure resolver live in iri.ts so tests and scripts
// can use them without loading astro:content; re-exported here because every
// existing caller imports them from the corpus.

export type { ResolvedRef } from "./iri";
export { SITE_BASE, urnToSlugPath, W3ID_BASE } from "./iri";

export function resolveRef(corpus: Corpus, urn: string): ResolvedRef {
  return resolveRefIn(corpus.nodeBySlugPath, urn);
}

/** Breadcrumb trail for a node: area → … → node (labels + urls). */
export function crumbsFor(
  corpus: Corpus,
  slugPath: string
): { label: string; slugPath: string; published: boolean }[] {
  const segs = slugPath.split("/");
  const crumbs = [];
  for (let i = 1; i <= segs.length; i += 1) {
    const partial = segs.slice(0, i).join("/");
    const node = corpus.nodeBySlugPath.get(partial);
    crumbs.push({
      label: node?.label ?? humanize(segs[i - 1]),
      published: Boolean(node),
      slugPath: partial,
    });
  }
  return crumbs;
}
