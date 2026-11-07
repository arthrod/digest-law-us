/**
 * Rebuilds public/.well-known/agent-skills/index.json (Agent Skills
 * discovery v0.2.0) from every `<name>/SKILL.md` beside it: name and
 * description from the frontmatter, digest = sha256 of the file's bytes.
 *
 *   bun scripts/agent-skills-index.ts
 *
 * Run it after editing a SKILL.md, and after the formatter has touched one:
 * src/lib/agent-discovery.test.ts fails when a digest no longer matches.
 */
import { createHash } from "node:crypto";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(
    import.meta.dirname,
    "../public/.well-known/agent-skills"
  ),
  entries = await readdir(DIR, { withFileTypes: true }),
  field = (text: string, key: string) =>
    new RegExp(`^${key}: (.+)$`, "mu").exec(text)?.[1]?.trim() ?? "",
  names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted(),
  skills = await Promise.all(
    names.map(async (name) => {
      const bytes = await Bun.file(path.join(DIR, name, "SKILL.md")).bytes(),
        text = new TextDecoder().decode(bytes);
      if (field(text, "name") !== name) {
        throw new Error(`${name}/SKILL.md: frontmatter name must be "${name}"`);
      }
      return {
        description: field(text, "description"),
        digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        name,
        type: "skill-md",
        url: `/.well-known/agent-skills/${name}/SKILL.md`,
      };
    })
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
