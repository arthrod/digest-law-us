/**
 * Corpus graph, derived once per build from the content collections.
 *
 * Everything downstream — routes, breadcrumbs, route-scoped trees, SKOS
 * resolution — reads from here. Navigation data is handed out per route
 * scope only (hard constraint 1): digest pages get breadcrumbs + rail,
 * area/container pages get their own subtree, and the full map exists on
 * the home page and /sitemap/ alone.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import { humanize, slugSegment } from "./labels";

export type Digest = CollectionEntry<"digests">;
export type SourceMeta = CollectionEntry<"sources">;
export type AuditEntry = CollectionEntry<"audits">;
<<<<<<< HEAD
export type IndexEntry =
  | CollectionEntry<"caselaw">
  | CollectionEntry<"statutory">;
=======
export type IndexEntry = CollectionEntry<"caselaw"> | CollectionEntry<"statutory">;
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
export type RunEntry = CollectionEntry<"runs">;

export interface TreeNode {
  segment: string;
  label: string;
  slugPath: string;
  dir: string;
  digest?: Digest;
  children: TreeNode[];
  /** published digests at or below this node */
  topicCount: number;
  /** deepest nesting below this node (0 = leaf) */
  maxDepth: number;
  /** retained sources held at or below */
  sourceCount: number;
  /** latest generation timestamp at or below (ISO) */
  latest: string;
}

export interface Corpus {
  digests: Digest[];
  byDir: Map<string, Digest>;
  nodeBySlugPath: Map<string, TreeNode>;
  areas: TreeNode[];
  doctrinalAreas: TreeNode[];
  compositeAreas: TreeNode[];
  auditsByDir: Map<string, AuditEntry>;
  caselawByDir: Map<string, IndexEntry>;
  statutoryByDir: Map<string, IndexEntry>;
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
}

function parentDir(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}

let corpusPromise: Promise<Corpus> | null = null;

export function getCorpus(): Promise<Corpus> {
  corpusPromise ??= build();
  return corpusPromise;
}

async function build(): Promise<Corpus> {
<<<<<<< HEAD
  const [rawDigests, auditsCol, caselawCol, statutoryCol, runsCol, sourcesCol] =
    await Promise.all([
      getCollection("digests"),
      getCollection("audits"),
      getCollection("caselaw"),
      getCollection("statutory"),
      getCollection("runs"),
      getCollection("sources"),
    ]);
=======
  const [rawDigests, auditsCol, caselawCol, statutoryCol, runsCol, sourcesCol] = await Promise.all([
    getCollection("digests"),
    getCollection("audits"),
    getCollection("caselaw"),
    getCollection("statutory"),
    getCollection("runs"),
    getCollection("sources"),
  ]);
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

  // A digest is the .md named after its own bundle directory. Anything else
  // that slipped through the glob is logged and dropped, never silently.
  const digests: Digest[] = [];
  for (const entry of rawDigests) {
    const segs = entry.id.split("/");
    if (segs.length >= 2 && segs[segs.length - 1] === segs[segs.length - 2]) {
      digests.push(entry);
    } else {
      console.warn(`[corpus] skipping non-digest markdown: ${entry.id}`);
    }
  }

  const byDir = new Map<string, Digest>();
  for (const d of digests) byDir.set(parentDir(d.id), d);

  const auditsByDir = new Map<string, AuditEntry>();
  for (const a of auditsCol) auditsByDir.set(parentDir(a.id), a);
  const caselawByDir = new Map<string, IndexEntry>();
  for (const c of caselawCol) caselawByDir.set(parentDir(c.id), c);
  const statutoryByDir = new Map<string, IndexEntry>();
  for (const s of statutoryCol) statutoryByDir.set(parentDir(s.id), s);
  const runsByDir = new Map<string, RunEntry>();
  for (const r of runsCol) runsByDir.set(parentDir(r.id), r);

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
    if (existing) return existing;
    const segs = dir.split("/");
    const segment = segs[segs.length - 1];
    const node: TreeNode = {
      segment,
      label: humanize(segment),
      slugPath: segs.map(slugSegment).join("/"),
      dir,
      children: [],
      topicCount: 0,
      maxDepth: 0,
      sourceCount: 0,
      latest: "",
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
<<<<<<< HEAD
    let sources = node.digest
      ? (sourcesByBundle.get(node.dir)?.length ?? 0)
      : 0;
=======
    let sources = node.digest ? (sourcesByBundle.get(node.dir)?.length ?? 0) : 0;
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
    let latest = node.digest?.data.timestamp ?? "";
    for (const child of node.children) {
      aggregate(child);
      topics += child.topicCount;
      depth = Math.max(depth, child.maxDepth + 1);
      sources += child.sourceCount;
      if (child.latest > latest) latest = child.latest;
    }
    node.topicCount = topics;
    node.maxDepth = depth;
    node.sourceCount = sources;
    node.latest = latest;
  }
  for (const root of roots) aggregate(root);
  roots.sort((a, b) => a.label.localeCompare(b.label));

  const nodeBySlugPath = new Map<string, TreeNode>();
  for (const node of nodeByDir.values()) nodeBySlugPath.set(node.slugPath, node);

<<<<<<< HEAD
  const doctrinalAreas = roots.filter(r => r.segment !== r.segment.toUpperCase());
  const compositeAreas = roots.filter(r => r.segment === r.segment.toUpperCase());
=======
  const doctrinalAreas = roots.filter((r) => r.segment !== r.segment.toUpperCase());
  const compositeAreas = roots.filter((r) => r.segment === r.segment.toUpperCase());
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

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
    if (!runsByDir.has(dir)) preProvenance++;
  }
  let latest = "";
  for (const root of roots) if (root.latest > latest) latest = root.latest;

  return {
    digests,
    byDir,
    nodeBySlugPath,
    areas: roots,
    doctrinalAreas,
    compositeAreas,
    auditsByDir,
    caselawByDir,
    statutoryByDir,
    runsByDir,
    sourcesByBundle,
    stats: {
      digests: digests.length,
      areas: roots.length,
      sources: sourceCount,
      sourceBytes,
      preProvenance,
      latest,
    },
  };
}

// ---- SKOS URN resolution ----

export const W3ID_BASE = "https://w3id.org/digest-law/us/";
export const SITE_BASE = "https://digest.law/";

export interface ResolvedRef {
  urn: string;
  /** lowercase-kebab path derived from the URN — always defined */
  slugPath: string;
  label: string;
  /** true when a page exists on this site for the ref */
  published: boolean;
}

export function urnToSlugPath(urn: string): string {
  const notation = urn.replace(/^urn:legal-taxonomy:issue:/, "");
<<<<<<< HEAD
  return notation
    .split(".")
    .map(slugSegment)
    .join("/");
=======
  return notation.split(".").map(slugSegment).join("/");
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
}

export function resolveRef(corpus: Corpus, urn: string): ResolvedRef {
  const slugPath = urnToSlugPath(urn);
  const node = corpus.nodeBySlugPath.get(slugPath);
  const lastSeg =
<<<<<<< HEAD
    urn.replace(/^urn:legal-taxonomy:issue:/, "").split(".").pop() ?? urn;
=======
    urn
      .replace(/^urn:legal-taxonomy:issue:/, "")
      .split(".")
      .pop() ?? urn;
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
  return {
    urn,
    slugPath,
    label: node?.label ?? humanize(lastSeg),
    published: Boolean(node),
  };
}

/** Breadcrumb trail for a node: area → … → node (labels + urls). */
export function crumbsFor(
  corpus: Corpus,
<<<<<<< HEAD
  slugPath: string
=======
  slugPath: string,
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
): Array<{ label: string; slugPath: string; published: boolean }> {
  const segs = slugPath.split("/");
  const crumbs = [];
  for (let i = 1; i <= segs.length; i++) {
    const partial = segs.slice(0, i).join("/");
    const node = corpus.nodeBySlugPath.get(partial);
    crumbs.push({
      label: node?.label ?? humanize(segs[i - 1]),
      slugPath: partial,
      published: Boolean(node),
    });
  }
  return crumbs;
}
