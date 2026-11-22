/**
 * 1. Writes the american-legal-digest SKILL.md from its hand-written template
 *    (src/skills/american-legal-digest/SKILL.template.md — edit THAT file,
 *    never the published copy) plus the "areas of law" block generated from
 *    the committed concept registry: every live top-level area, its route and
 *    its concept count (src/lib/agent-skills.ts). The registry,
 *    not dist/, is the input, so this runs BEFORE `astro build` and the build
 *    copies the fresh file into dist/ with the rest of public/.
 * 2. Rebuilds public/.well-known/agent-skills/index.json (Agent Skills
 *    discovery v0.2.0) from every `<name>/SKILL.md` beside it: name and
 * description from the YAML frontmatter, digest = sha256 of the file's
 * bytes (src/lib/agent-skills.ts). A SKILL.md without frontmatter, or whose
 * name is not its folder's, fails the run.
 *
 *   bun scripts/agent-skills-index.ts
 *
 * Run it after editing a SKILL.md, and after the formatter has touched one:
 * src/lib/agent-discovery.test.ts fails when a digest no longer matches.
 */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  areasBlock,
  skillEntry,
  topLevelAreas,
  withAreas,
} from "../src/lib/agent-skills";
import { allConcepts } from "../src/lib/concept-ids";
import { toCatalog } from "../src/lib/mcp-catalog";

const DIR = path.join(
    import.meta.dirname,
    "../public/.well-known/agent-skills"
  ),
  SKILL_MD = path.join(DIR, "american-legal-digest/SKILL.md"),
  TEMPLATE = path.join(
    import.meta.dirname,
    "../src/skills/american-legal-digest/SKILL.template.md"
  ),
  areas = topLevelAreas(toCatalog(allConcepts()).concepts),
  next = withAreas(
    await Bun.file(TEMPLATE).text(),
    areasBlock(areas, "https://digest.law")
  ),
  previous = (await Bun.file(SKILL_MD).exists())
    ? await Bun.file(SKILL_MD).text()
    : "";

if (areas.length === 0) {
  console.error("No live top-level area in the registry; SKILL.md left as is.");
  process.exit(1);
}
if (next !== previous) {
  await writeFile(SKILL_MD, next);
}
console.log(
  `american-legal-digest/SKILL.md: ${areas.length} areas${next === previous ? " (unchanged)" : ""}`
);

// oxlint-disable-next-line eslint/one-var -- the index is read only after SKILL.md is rewritten
const entries = await readdir(DIR, { withFileTypes: true }),
  names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted(),
  skills = await Promise.all(
    names.map(async (name) =>
      skillEntry(name, await Bun.file(path.join(DIR, name, "SKILL.md")).bytes())
    )
  );

await writeFile(
  path.join(DIR, "index.json"),
  `${JSON.stringify(
    {
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills,
    },
    null,
    2
  )}\n`
);
console.log(`agent-skills/index.json: ${skills.length} skill(s)`);
