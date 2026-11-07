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
 * reads the two JSON maps at runtime (`/id/*` and `/mcp`); the server card is
 * what the Worker's own `Link` header points at.
 */
export const REQUIRED_ROOT_FILES: readonly string[] = [
  "id-map.json",
  "mcp-catalog.json",
  ".well-known/mcp/server-card.json",
];

export async function missingRootFiles(
  has: (file: string) => boolean | Promise<boolean>
): Promise<string[]> {
  const present = await Promise.all(
    REQUIRED_ROOT_FILES.map(async (file) => await has(file))
  );
  return REQUIRED_ROOT_FILES.filter((_, index) => !present[index]);
}
