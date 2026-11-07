/**
 * Checks the <head> of a built site (src/lib/head-check.ts says what).
 *
 *   bun scripts/check-head.ts                  # dist/, 300 pages
 *   bun scripts/check-head.ts dist-preview --all
 *   bun scripts/check-head.ts dist --sample=2000
 *
 * The sample is spread evenly over the sorted routes and always holds the
 * home page, so two runs on one dist read the same pages. Exits 1 when a
 * sampled page has a problem, when sampled digest pages share a
 * description, when the dist holds no page at all, or when --sample is not
 * a positive integer.
 */
import path from "node:path";

import {
  duplicateDescriptions,
  evenSample,
  headProblems,
  headTags,
  pageKind,
  problemCounts,
} from "../src/lib/head-check";
import type { PageKind } from "../src/lib/head-check";

const args = process.argv.slice(2),
  dist = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "dist"),
  routes: string[] = [],
  sampleArg = args.find((arg) => arg.startsWith("--sample=")),
  size = args.includes("--all")
    ? Number.POSITIVE_INFINITY
    : Number(sampleArg?.slice("--sample=".length) ?? 300);

if (
  size !== Number.POSITIVE_INFINITY &&
  !(Number.isInteger(size) && size > 0)
) {
  // A typo here would otherwise check the home page alone and pass.
  console.log(`--sample must be a positive integer, got "${sampleArg}"`);
  process.exit(1);
}

for await (const file of new Bun.Glob("**/index.html").scan(dist)) {
  routes.push(`/${file.slice(0, -"index.html".length)}`);
}
if (routes.length === 0) {
  console.log(`no index.html under ${dist}: nothing to check`);
  process.exit(1);
}

// oxlint-disable-next-line eslint/one-var -- the sample needs the routes found above
const descriptions: { description: string; path: string }[] = [],
  failures: { path: string; problems: string[] }[] = [],
  kinds: Record<PageKind, number> = { digest: 0, home: 0, page: 0 },
  sample = evenSample(routes, size);

for (const route of sample) {
  const html = await Bun.file(path.join(dist, route, "index.html")).text(),
    kind = pageKind(route, html),
    problems = headProblems(html, kind);
  kinds[kind] += 1;
  if (problems.length > 0) {
    failures.push({ path: route, problems });
  }
  if (kind === "digest") {
    const description = headTags(html).find(
      (tag) => tag.name === "meta" && tag.attrs.name === "description"
    )?.attrs.content;
    descriptions.push({ description: description ?? "", path: route });
  }
}

// oxlint-disable-next-line eslint/one-var -- computed once every page is read
const counts = problemCounts(failures.map((failure) => failure.problems)),
  shared = duplicateDescriptions(descriptions);

console.log(
  `${sample.length} pages checked: ${kinds.home} home, ${kinds.digest} digest, ${kinds.page} other (of ${routes.length} in ${dist})`
);
if (counts.length === 0 && shared.length === 0) {
  console.log("no problems");
} else if (counts.length > 0) {
  console.log("\npages failing each check:");
  for (const [check, pages] of counts) {
    const example = failures.find((failure) =>
      failure.problems.some((problem) => problem.startsWith(`${check}: `))
    );
    console.log(
      `  ${check.padEnd(24)} ${String(pages).padStart(6)}   e.g. ${example?.path ?? ""}`
    );
  }
}
if (shared.length > 0) {
  console.log(`\nshared descriptions: ${shared.length}`);
  for (const line of shared.slice(0, 5)) {
    console.log(`  ${line.length > 200 ? `${line.slice(0, 200)}…` : line}`);
  }
}
process.exit(counts.length > 0 || shared.length > 0 ? 1 : 0);
