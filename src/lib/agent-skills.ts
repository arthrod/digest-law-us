/**
 * One entry of `/.well-known/agent-skills/index.json` (Agent Skills
 * discovery v0.2.0), built from a SKILL.md's bytes. The frontmatter is
 * parsed as YAML (gray-matter), so quoted and folded values come out as the
 * text they stand for, and nothing in the body can pass for metadata.
 */
import { createHash } from "node:crypto";

import matter from "gray-matter";

export interface SkillEntry {
  description: string;
  digest: string;
  name: string;
  type: "skill-md";
  url: string;
}

export function skillEntry(name: string, bytes: Uint8Array): SkillEntry {
  const file = `${name}/SKILL.md`,
    text = new TextDecoder().decode(bytes);
  if (!matter.test(text)) {
    throw new Error(`${file}: no YAML frontmatter`);
  }
  // oxlint-disable-next-line eslint/one-var -- parsed only once frontmatter is known to be there
  const { data } = matter(text) as { data: Record<string, unknown> };
  if (data.name !== name) {
    throw new Error(`${file}: frontmatter name must be "${name}"`);
  }
  if (typeof data.description !== "string" || !data.description.trim()) {
    throw new Error(`${file}: frontmatter needs a description`);
  }
  return {
    description: data.description.trim(),
    digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    name,
    type: "skill-md",
    url: `/.well-known/agent-skills/${name}/SKILL.md`,
  };
}
