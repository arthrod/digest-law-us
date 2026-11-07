/**
 * Writes `dist/mcp-catalog.json`, the concept catalog the `/mcp` Worker reads
 * (worker/mcp.ts fetches it once per isolate, like `/id-map.json`).
 *
 *   bun scripts/write-mcp-catalog.ts          # dist/
 *   bun scripts/write-mcp-catalog.ts <dist>   # any build output
 *
 * It runs after `astro build` in `pnpm run build`, and needs nothing but a
 * built dist and the committed registry — so it can also be run on its own
 * before a root-only deploy, without a rebuild.
 *
 * Only concepts whose page is in THIS dist are listed: a concept minted after
 * the build, or a digest the frontmatter check left out, has no page to send
 * an agent to. Tombstones are kept; `/id/{id}` answers for them either way.
 * An empty catalog is refused rather than written, because the Worker would
 * serve it as "no matches" for every query.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { allConcepts } from "../src/lib/concept-ids";
import { toCatalog, withBuiltPages } from "../src/lib/mcp-catalog";

const dist = path.resolve(process.argv[2] ?? "dist"),
  pageOf = (route: string) => Bun.file(path.join(dist, route, "index.html"));

if (!(await Bun.file(path.join(dist, "index.html")).exists())) {
  console.error(`No build at ${dist} — run the build first.`);
  process.exit(1);
}

// oxlint-disable-next-line eslint/one-var -- only meaningful once dist is known to be a build
const full = toCatalog(allConcepts()),
  routes = [
    ...new Set(
      full.concepts.flatMap((concept) => [
        concept.route,
        concept.successor ?? "",
      ])
    ),
  ].filter(Boolean),
  // oxlint-disable-next-line eslint/sort-vars -- present depends on routes (TDZ)
  present = await Promise.all(
    routes.map(async (route) => await pageOf(route).exists())
  ),
  // oxlint-disable-next-line eslint/sort-vars -- built depends on routes and present
  built = new Set(routes.filter((_, index) => present[index])),
  { catalog, dropped } = withBuiltPages(full, (route) => built.has(route)),
  // oxlint-disable-next-line eslint/sort-vars -- live depends on catalog (TDZ)
  live = catalog.concepts.filter((concept) => !concept.retired).length;

if (live === 0) {
  console.error(
    `No concept in the registry has a page in ${dist}; refusing to write an empty catalog.`
  );
  process.exit(1);
}

await writeFile(path.join(dist, "mcp-catalog.json"), JSON.stringify(catalog));
console.log(
  `mcp-catalog.json: ${live} live, ${catalog.concepts.length - live} retired, ` +
    `${dropped.length} left out (no page in this build)`
);
