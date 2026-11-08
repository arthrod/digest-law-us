#!/usr/bin/env bun
/**
 * Validate every digest's frontmatter against the collection schema, and every
 * data-collection entry's JSON, offline.
 *
 * A cold `astro build` spends hours in content sync before it reaches the
 * first malformed entry, then aborts on that one entry alone. This walks the
 * same globs, parses frontmatter with Astro's own parser, runs the same zod
 * schema, and JSON.parses the `runs` collection's `run.json` files, so every
 * bad entry surfaces in about 20 seconds, all at once.
 *
 * Every failing entry is written to FRONTMATTER_EXCLUDES_FILE, which
 * src/content.config.ts leaves out of the digests and runs collections, so the
 * build goes ahead without those entries (see src/lib/frontmatter-excludes.ts).
 * A corrupt `run.json` costs one bundle its provenance panel; before this it
 * cost the entire build (`@@ -0,0 +1,531 @@` left at the top of a manifest
 * aborted a cold sync 24 minutes in).
 *
 *   bun scripts/check-digest-frontmatter.ts            record failures, exit 0
 *   bun scripts/check-digest-frontmatter.ts --strict   also exit 1 on any failure
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "@astrojs/markdown-remark";
import { glob } from "tinyglobby";

import { CORPUS_DIR } from "../src/corpus.config";
import { digestSchema } from "../src/lib/digest-schema";
import { FRONTMATTER_EXCLUDES_FILE } from "../src/lib/frontmatter-excludes";

const corpusRoot = path.resolve(CORPUS_DIR),
  excluded: string[] = [],
  failures: string[] = [],
  files = await glob(["**/*.md"], {
    cwd: corpusRoot,
    ignore: [
      "**/index.md",
      "**/timestamp.md",
      "**/caselaw_index.md",
      "**/statutory_index.md",
      "**/_source_snippet_audit.md",
      "**/sources/**",
    ],
  }),
  /**
   * Data-collection entries: the glob loader JSON.parses each of these, so one
   * broken manifest aborts content sync exactly like a bad digest does. Every
   * pattern here must match a `defineCollection` glob in src/content.config.ts.
   */
  manifests = await glob(["**/run.json"], { cwd: corpusRoot });

for (const rel of files) {
  let data: unknown;
  try {
    ({ frontmatter: data } = parseFrontmatter(
      await readFile(path.join(corpusRoot, rel), "utf8")
    ));
  } catch (error) {
    excluded.push(rel);
    failures.push(`${rel}\n    unparseable frontmatter: ${String(error)}`);
    continue;
  }
  const result = digestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `    ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    excluded.push(rel);
    failures.push(`${rel}\n${issues}`);
  }
}

for (const rel of manifests) {
  try {
    JSON.parse(await readFile(path.join(corpusRoot, rel), "utf8"));
  } catch (error) {
    excluded.push(rel);
    failures.push(`${rel}\n    unparseable JSON: ${String(error)}`);
  }
}

await writeFile(
  FRONTMATTER_EXCLUDES_FILE,
  `${JSON.stringify(excluded.toSorted(), null, 2)}\n`
);

console.log(
  `digests checked: ${files.length}, data entries checked: ${manifests.length}, failing: ${failures.length}${
    failures.length > 0
      ? ` (excluded from the build via ${FRONTMATTER_EXCLUDES_FILE})`
      : ""
  }`
);
for (const f of failures) {
  console.log(`  ${f}`);
}
process.exit(failures.length > 0 && process.argv.includes("--strict") ? 1 : 0);
