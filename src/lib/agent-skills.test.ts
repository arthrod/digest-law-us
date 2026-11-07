/**
 * SKILL.md → index entry: real YAML frontmatter, never the body.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { skillEntry } from "./agent-skills";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const PLAIN = bytes(
  "---\nname: demo\ndescription: Find things.\n---\n\n# Demo\n"
);

describe("skillEntry", () => {
  test("reads name and description from the frontmatter", () => {
    expect(skillEntry("demo", PLAIN)).toEqual({
      description: "Find things.",
      digest: `sha256:${createHash("sha256").update(PLAIN).digest("hex")}`,
      name: "demo",
      type: "skill-md",
      url: "/.well-known/agent-skills/demo/SKILL.md",
    });
  });

  test("unquotes a quoted description", () => {
    const entry = skillEntry(
      "demo",
      bytes('---\nname: demo\ndescription: "Find: cite, read."\n---\n')
    );
    expect(entry.description).toBe("Find: cite, read.");
  });

  test("joins a folded description", () => {
    const entry = skillEntry(
      "demo",
      bytes(
        "---\nname: demo\ndescription: >-\n  Find things\n  and cite them.\n---\n"
      )
    );
    expect(entry.description).toBe("Find things and cite them.");
  });

  test.each([
    ["no frontmatter", "# Demo\n\nname: demo\ndescription: x\n"],
    ["a name only in the body", "---\ndescription: x\n---\n\nname: demo\n"],
    ["another name", "---\nname: other\ndescription: x\n---\n"],
    ["no description", "---\nname: demo\n---\n"],
  ])("refuses a SKILL.md with %s", (_label, text) => {
    expect(() => skillEntry("demo", bytes(text))).toThrow("demo/SKILL.md");
  });
});
