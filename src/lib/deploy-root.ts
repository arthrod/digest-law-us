/**
 * What the root `digest-law` Worker must carry itself, whatever the shard
 * packer in scripts/deploy-shards.ts decides.
 *
 * Shards have no route of their own: the root reaches them over service
 * bindings, and only for paths in `run_worker_first`. Discovery documents
 * (`/.well-known/*`) are small, fetched by agents before anything else, and
 * must answer on a root-only deploy — so dot-folders are never sharded.
 */

/** Top-level dist folders that never go to a shard. */
export function staysOnRoot(folder: string): boolean {
  return folder.startsWith(".");
}

/**
 * Paths under dist/ that a deploy must not ship without. The root Worker
 * reads the two JSON maps at runtime (`/id/*` and `/mcp`); the API catalog,
 * the server card and the skills index are what the Worker's own `Link`
 * headers and the API catalog point at.
 */
export const REQUIRED_ROOT_FILES: readonly string[] = [
  "id-map.json",
  "mcp-catalog.json",
  ".well-known/api-catalog",
  ".well-known/agent-skills/index.json",
  ".well-known/mcp/server-card.json",
  // Every page links to these two (Layout.astro).
  "rss.xml",
  "webmcp.js",
];

export async function missingRootFiles(
  has: (file: string) => boolean | Promise<boolean>
): Promise<string[]> {
  const present = await Promise.all(
    REQUIRED_ROOT_FILES.map(async (file) => await has(file))
  );
  return REQUIRED_ROOT_FILES.filter((_, index) => !present[index]);
}

/**
 * The maps the Worker fetches whole with `env.ASSETS.fetch` (worker/index.ts
 * loadIdMap, worker/mcp.ts loadCatalog). A file past the asset cap is split
 * into parts that only the Worker's oversize route reassembles, so a split
 * map would read as missing and `/id/*` or `/mcp` would stop answering.
 */
// oxlint-disable-next-line eslint/one-var -- documented next to splitWorkerReads, its one reader
export const WORKER_READ_FILES: readonly string[] = [
  "id-map.json",
  "mcp-catalog.json",
];

/** Worker-read maps among the oversize URL paths (`/name`) the packer split. */
export function splitWorkerReads(oversizePaths: readonly string[]): string[] {
  const split = new Set(oversizePaths.map((urlPath) => urlPath.slice(1)));
  return WORKER_READ_FILES.filter((file) => split.has(file));
}

/**
 * public/ paths whose dist/ copy is missing or different. `astro build`
 * copies public/ into dist/; a root-only deploy ships dist/ as it is, so an
 * edit to public/_headers or public/.well-known/ that was not copied over
 * would ship stale. pagefind/ is skipped: it is copied the other way, from
 * dist/ into public/.
 */
export async function staleCopies(
  publicFiles: readonly string[],
  sameInDist: (file: string) => boolean | Promise<boolean>
): Promise<string[]> {
  const compared = publicFiles.filter((file) => !file.startsWith("pagefind/")),
    // oxlint-disable-next-line eslint/sort-vars -- same is computed from compared (TDZ)
    same = await Promise.all(
      compared.map(async (file) => await sameInDist(file))
    );
  return compared.filter((_, index) => !same[index]);
}
