#!/usr/bin/env bun
/**
 * Validate every digest's frontmatter against the collection schema, offline.
 *
 * A cold `astro build` spends 30-100 minutes in content sync before it reaches
 * the first malformed digest, then aborts on that one entry alone. This walks
 * the same glob, parses frontmatter with Astro's own parser, and runs the same
 * zod schema, so every bad entry surfaces in about a minute, all at once.
 *
 *   bun scripts/check-digest-frontmatter.ts     exit 1 if any digest fails
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "@astrojs/markdown-remark";
import { glob } from "tinyglobby";

import { CORPUS_DIR } from "../src/corpus.config";
import { digestSchema } from "../src/lib/digest-schema";

const corpusRoot = path.resolve(CORPUS_DIR),
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
    failures.push(`${rel}\n    unparseable frontmatter: ${String(error)}`);
    continue;
  }
  const result = digestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `    ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    failures.push(`${rel}\n${issues}`);
  }
}

console.log(`digests checked: ${files.length}, failing: ${failures.length}`);
for (const f of failures) {
  console.log(`  ${f}`);
}
process.exit(failures.length > 0 ? 1 : 0);
