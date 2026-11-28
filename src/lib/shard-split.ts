/**
 * Folders too big for one shard Worker (100,000 assets each), split one
 * level deeper by scripts/deploy-shards.ts and routed by worker/index.ts.
 *
 * Pagefind writes one fragment per indexed page into a single flat folder,
 * named `<lang>_<hash>.pf_fragment`. Fragments bucket by language plus the
 * first hash character (`pagefind/fragment/en_3`): 16 buckets per language,
 * each a routing unit of its own. Everything else under `pagefind/` stays
 * one unit named `pagefind`.
 */

/** Split dirs: exactly `<top folder>/<dir>`, holding files only. */
export const SPLIT_DIRS: readonly string[] = ["pagefind/fragment"];

/** The bucket unit a dist-relative file belongs to, if it is in a split dir. */
export function splitUnitOf(relPath: string): string | undefined {
  for (const dir of SPLIT_DIRS) {
    if (!relPath.startsWith(`${dir}/`)) {
      continue;
    }
    const name = relPath.slice(dir.length + 1),
      underscore = name.indexOf("_");
    if (name.includes("/")) {
      throw new Error(
        `${relPath}: split dir ${dir} must hold files only — refusing to guess a route.`
      );
    }
    if (underscore < 1 || underscore + 1 >= name.length) {
      throw new Error(`${relPath}: not a <lang>_<hash> file name.`);
    }
    return `${dir}/${name.slice(0, underscore + 2)}`;
  }
  return undefined;
}

/**
 * The service binding for a request path: a split bucket is a prefix of the
 * file name (longest wins); otherwise only an exact first segment forwards,
 * so /pagefind-ui.js or /sitemap-index.xml stay root assets.
 */
export function shardKeyFor(
  map: Record<string, string> | undefined,
  pathname: string
): string | undefined {
  if (!map) {
    return undefined;
  }
  const rest = pathname.slice(1);
  let best = "";
  for (const key of Object.keys(map)) {
    if (key.includes("/") && rest.startsWith(key) && key.length > best.length) {
      best = key;
    }
  }
  return map[best || (rest.split("/")[0] ?? "")];
}

/**
 * `.assetsignore` lines that whitelist one shard's units for wrangler's
 * gitignore-style engine. A file cannot be re-included under an excluded
 * directory, so a split dir's *contents* are excluded, never the dir itself.
 */
export function shardIgnoreLines(units: readonly string[]): string[] {
  const folders = units.filter((unit) => !unit.includes("/")),
    lines = ["/*", "!/404.html"];
  for (const folder of folders) {
    lines.push(`!/${folder}/`);
    for (const dir of SPLIT_DIRS) {
      if (dir.startsWith(`${folder}/`)) {
        lines.push(`/${dir}/*`);
      }
    }
  }
  for (const dir of SPLIT_DIRS) {
    const buckets = units.filter((unit) => unit.startsWith(`${dir}/`)),
      [top] = dir.split("/");
    if (buckets.length === 0) {
      continue;
    }
    if (!folders.includes(top ?? "")) {
      lines.push(`!/${top}/`, `/${top}/*`, `!/${dir}/`, `/${dir}/*`);
    }
    for (const bucket of buckets.toSorted()) {
      lines.push(`!/${bucket}*`);
    }
  }
  return lines;
}
