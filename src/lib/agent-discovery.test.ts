/**
 * The static discovery documents under public/.well-known/: what an agent
 * fetches before it fetches anything else.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

const PUBLIC = new URL("../../public/", import.meta.url),
  SITE = "https://digest.law",
  SKILL_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u,
  read = (path: string) => Bun.file(new URL(path, PUBLIC)),
  // oxlint-disable-next-line eslint/sort-vars -- catalog, headers and index use read (TDZ)
  catalog = (await read(".well-known/api-catalog").json()) as {
    linkset: Record<string, { href: string; type?: string }[] | string>[];
  },
  // oxlint-disable-next-line eslint/sort-vars -- see above
  headers = await read("_headers").text(),
  // oxlint-disable-next-line eslint/sort-vars -- see above
  index = (await read(".well-known/agent-skills/index.json").json()) as {
    $schema: string;
    skills: {
      description: string;
      digest: string;
      name: string;
      type: string;
      url: string;
    }[];
  };

function hrefs(): string[] {
  return catalog.linkset.flatMap((entry) =>
    Object.entries(entry).flatMap(([key, value]) =>
      key === "anchor"
        ? [String(value)]
        : (value as { href: string }[]).map((l) => l.href)
    )
  );
}

describe("API catalog (RFC 9727)", () => {
  test("is a linkset whose every URL is absolute on digest.law", () => {
    expect(catalog.linkset.length).toBeGreaterThan(0);
    for (const href of hrefs()) {
      expect(href.startsWith(`${SITE}/`)).toBe(true);
    }
  });

  test("describes the MCP endpoint by its server card", () => {
    const mcp = catalog.linkset.find((entry) => entry.anchor === `${SITE}/mcp`);
    expect(mcp?.["service-desc"]).toEqual([
      {
        href: `${SITE}/.well-known/mcp/server-card.json`,
        type: "application/json",
      },
    ]);
  });

  test("every linked document is one this site publishes", async () => {
    const local = hrefs()
      .map((href) => new URL(href).pathname)
      .filter((path) => path.startsWith("/.well-known/"));
    for (const path of local) {
      expect(await read(path.slice(1)).exists()).toBe(true);
    }
  });

  test("is served as application/linkset+json", () => {
    expect(headers).toMatch(
      /\/\.well-known\/api-catalog\n\s+Content-Type: application\/linkset\+json/u
    );
  });
});

describe("Agent Skills index (v0.2.0)", () => {
  test("declares the v0.2.0 discovery schema", () => {
    expect(index.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json"
    );
    expect(index.skills.length).toBeGreaterThan(0);
  });

  test("every skill name follows the naming rule", () => {
    for (const skill of index.skills) {
      expect(skill.name).toMatch(SKILL_NAME);
      expect(skill.name).not.toContain("--");
    }
  });

  test("every digest is the sha256 of the published SKILL.md", async () => {
    for (const skill of index.skills) {
      const bytes = await read(skill.url.slice(1)).bytes(),
        digest = createHash("sha256").update(bytes).digest("hex");
      expect(skill.type).toBe("skill-md");
      // A mismatch means a SKILL.md changed: run `pnpm run skills:index`.
      expect(skill.digest).toBe(`sha256:${digest}`);
    }
  });

  test("every SKILL.md frontmatter matches its index entry", async () => {
    for (const skill of index.skills) {
      const text = await read(skill.url.slice(1)).text();
      expect(text).toContain(`\nname: ${skill.name}\n`);
      expect(text).toContain(`\ndescription: ${skill.description}\n`);
    }
  });
});
