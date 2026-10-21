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

import { CORPUS_DIR, PREVIEW_MODE } from "@/corpus.config";

import type { ResolvedRef } from "./iri";
import { resolveRefIn } from "./iri";
import { humanize, slugSegment } from "./labels";
import { previewBundles } from "./preview";

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
  /** retained sources in this node's own bundle only (never descendants) */
  ownSourceCount: number;
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
      ]),
    auditsByDir = new Map<string, AuditEntry>(),
    byDir = new Map<string, Digest>(),
    caselawByDir = new Map<string, IndexEntry>(),
    nodeByDir = new Map<string, TreeNode>(),
    nodeBySlugPath = new Map<string, TreeNode>(),
    roots: TreeNode[] = [],
    runsByDir = new Map<string, RunEntry>(),
    sourcesByBundle = new Map<string, SourceMeta[]>(),
    statutoryByDir = new Map<string, IndexEntry>();

  // A digest is the .md named after its own bundle directory. Anything else
  // that slipped through the glob is logged and dropped, never silently.
  let digests: Digest[] = [],
    preProvenance = 0,
    sourceBytes = 0,
    sourceCount = 0;
  for (const entry of rawDigests) {
    const segs = entry.id.split("/");
    if (segs.length >= 2 && segs.at(-1) === segs.at(-2)) {
      digests.push(entry);
    } else {
      console.warn(`[corpus] skipping non-digest markdown: ${entry.id}`);
    }
  }

  for (const d of digests) {
    byDir.set(parentDir(d.id), d);
  }

  for (const a of auditsCol) {
    auditsByDir.set(parentDir(a.id), a);
  }
  for (const c of caselawCol) {
    caselawByDir.set(parentDir(c.id), c);
  }
  for (const s of statutoryCol) {
    statutoryByDir.set(parentDir(s.id), s);
  }
  for (const r of runsCol) {
    runsByDir.set(parentDir(r.id), r);
  }

  for (const s of sourcesCol) {
    const list = sourcesByBundle.get(s.data.bundle) ?? [];
    list.push(s);
    sourcesByBundle.set(s.data.bundle, list);
  }
  for (const list of sourcesByBundle.values()) {
    list.sort((a, b) => a.data.slug.localeCompare(b.data.slug));
  }

  // The content collections were already narrowed to these bundles (see
  // content.config.ts), so this is a consistency net rather than the cut:
  // it drops anything a stale content-layer cache still holds.
  if (PREVIEW_MODE) {
    const kept = await previewBundles(CORPUS_DIR),
      maps = [
        auditsByDir,
        caselawByDir,
        statutoryByDir,
        runsByDir,
        sourcesByBundle,
      ];
    for (const map of maps) {
      for (const dir of map.keys()) {
        if (!kept.has(dir)) {
          map.delete(dir);
        }
      }
    }
    for (const dir of byDir.keys()) {
      if (!kept.has(dir)) {
        byDir.delete(dir);
      }
    }
    digests = digests.filter((d) => kept.has(parentDir(d.id)));
    console.warn(
      `[corpus] PREVIEW MODE — ${kept.size} bundles, ${digests.length} digests; a partial corpus, never deploy this output`
    );
  }

  // ---- Tree ----
  function ensureNode(dir: string): TreeNode {
    const existing = nodeByDir.get(dir);
    if (existing) {
      return existing;
    }
    // oxlint-disable-next-line eslint/one-var -- keep construction behind the cache-hit early return
    const segs = dir.split("/"),
      // split() never yields an empty array, so the fallback never fires — it
      // exists to keep `segment` a string without an assertion.
      // oxlint-disable-next-line eslint/sort-vars -- segment is derived from segs
      segment = segs.at(-1) ?? dir,
      // oxlint-disable-next-line eslint/sort-vars -- node is built from segs and segment
      node: TreeNode = {
        children: [],
        dir,
        label: humanize(segment),
        latest: "",
        maxDepth: 0,
        ownSourceCount: 0,
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
    let depth = 0,
      topics = node.digest ? 1 : 0;
    node.ownSourceCount = sourcesByBundle.get(node.dir)?.length ?? 0;
    // oxlint-disable-next-line eslint/one-var -- sources reads ownSourceCount, assigned just above
    let latest = node.digest?.data.timestamp ?? "",
      sources = node.ownSourceCount;
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

  for (const node of nodeByDir.values()) {
    nodeBySlugPath.set(node.slugPath, node);
  }

  // oxlint-disable-next-line eslint/one-var -- the area split must follow the tree build and sort above
  const compositeAreas = roots.filter(
      (r) => r.segment === r.segment.toUpperCase()
    ),
    doctrinalAreas = roots.filter((r) => r.segment !== r.segment.toUpperCase());

  for (const list of sourcesByBundle.values()) {
    for (const s of list) {
      sourceBytes += s.data.bytes;
      sourceCount += 1;
    }
  }
  for (const dir of byDir.keys()) {
    if (!runsByDir.has(dir)) {
      preProvenance += 1;
    }
  }
  // oxlint-disable-next-line eslint/one-var -- hoisting latest above aggregate() would make its local latest trip no-shadow
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
  const crumbs = [],
    segs = slugPath.split("/");
  for (let i = 1; i <= segs.length; i += 1) {
    const partial = segs.slice(0, i).join("/"),
      // oxlint-disable-next-line eslint/sort-vars -- node is looked up by partial
      node = corpus.nodeBySlugPath.get(partial);
    crumbs.push({
      label: node?.label ?? humanize(segs[i - 1]),
      published: Boolean(node),
      slugPath: partial,
    });
  }
  return crumbs;
}
