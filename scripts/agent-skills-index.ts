/**
 * Rebuilds public/.well-known/agent-skills/index.json (Agent Skills
 * discovery v0.2.0) from every `<name>/SKILL.md` beside it: name and
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

import { skillEntry } from "../src/lib/agent-skills";

const DIR = path.join(
    import.meta.dirname,
    "../public/.well-known/agent-skills"
  ),
  entries = await readdir(DIR, { withFileTypes: true }),
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
