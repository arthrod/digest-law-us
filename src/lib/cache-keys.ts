/**
 * Cache-key composition for experimental incremental builds.
 *
 * Astro reuses a prerendered path only when three things match the previous
 * build: the route's module-graph hash (code), the render hashes of every
 * content entry the path `render()`ed (rendered bodies), and the path's
 * `cacheKey`. The first two are Astro's; the cacheKey is ours, and it must
 * cover every input the page reads that the other two cannot see — entry
 * data used outside `render()`, sibling entries in the same bundle, subtree
 * aggregates, and cross-node resolution state (a SKOS ref flips to
 * `published` when a digest appears elsewhere in the corpus). An
 * under-inclusive key ships a stale page with no error anywhere, so the
 * compositions here lean over-inclusive: the worst an extra part can cause
 * is one unnecessary render.
 *
 * Pure on purpose — no astro imports — so `bun test` covers it.
 */
import { createHash } from "node:crypto";

/** The identity + content-digest pair every content-layer entry carries. */
export interface EntryLike {
  id: string;
  digest?: string | number;
}

/** Shape of `ResolvedRef` that affects rendering (see lib/iri.ts). */
export interface RefLike {
  label: string;
  published: boolean;
  slugPath: string;
  urn: string;
}

/** Structural subset of `TreeNode` the subtree walk needs. */
export interface KeyNode {
  children: KeyNode[];
  digest?: EntryLike;
  dir: string;
  slugPath: string;
}

/**
 * One entry's contribution to a key. Absence is a distinct value: an audit
 * file being deleted must move the digest page's key just as surely as the
 * audit changing.
 */
export function stampEntry(entry: EntryLike | undefined | null): string {
  return entry ? `e:${entry.id}#${entry.digest ?? ""}` : "e:∅";
}

/**
 * One resolved SKOS ref's contribution. The rail renders the target's label
 * and links it only when published, so both are inputs.
 */
export function stampRef(ref: RefLike): string {
  return `r:${ref.urn}→${ref.slugPath}#${ref.published ? 1 : 0}#${ref.label}`;
}

/**
 * Everything an area/container page reads from its subtree: the structure
 * (slugPaths), each digest entry (labels, timestamps, profiles, `latest`
 * roll-ups all derive from it), and each bundle's source entries (source
 * counts and glance lines derive from those). Depth-first over `children`,
 * which the corpus sorts deterministically before this runs.
 */
export function subtreeStamps(
  node: KeyNode,
  sourcesByBundle: ReadonlyMap<string, EntryLike[]>
): string[] {
  const stamps: string[] = [
    `n:${node.slugPath}`,
    stampEntry(node.digest),
    ...(sourcesByBundle.get(node.dir) ?? []).map(stampEntry),
  ];
  for (const child of node.children) {
    stamps.push(...subtreeStamps(child, sourcesByBundle));
  }
  return stamps;
}

/**
 * Collapse parts into the `cacheKey` string handed to Astro. Hashed so 57k
 * manifest entries stay small; length-prefixed so no two part lists can
 * collide by boundary shifting; scoped so the digest page and the audit
 * page of the same bundle never share a key.
 */
export function cacheKeyFrom(scope: string, parts: readonly string[]): string {
  const h = createHash("sha256");
  h.update(`${scope.length}:${scope}`);
  for (const part of parts) {
    h.update(`${part.length}:${part}`);
  }
  return h.digest("hex");
}
