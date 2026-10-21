#!/usr/bin/env bun
/**
 * Validate every digest's frontmatter against the collection schema, offline.
 *
 * A cold `astro build` spends hours in content sync before it reaches the
 * first malformed digest, then aborts on that one entry alone. This walks the
 * same glob, parses frontmatter with Astro's own parser, and runs the same zod
 * schema, so every bad entry surfaces in about 20 seconds, all at once.
 *
 * Every failing digest is written to FRONTMATTER_EXCLUDES_FILE, which
 * src/content.config.ts leaves out of the digests collection, so the build
 * goes ahead without those pages (see src/lib/frontmatter-excludes.ts).
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
  });

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

await writeFile(
  FRONTMATTER_EXCLUDES_FILE,
  `${JSON.stringify(excluded.toSorted(), null, 2)}\n`
);

console.log(
  `digests checked: ${files.length}, failing: ${failures.length}${
    failures.length > 0
      ? ` (excluded from the build via ${FRONTMATTER_EXCLUDES_FILE})`
      : ""
  }`
);
for (const f of failures) {
  console.log(`  ${f}`);
}
process.exit(failures.length > 0 && process.argv.includes("--strict") ? 1 : 0);
