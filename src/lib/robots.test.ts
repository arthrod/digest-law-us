/**
 * robots.txt: open to search and AI crawlers, with Content Signals.
 */
import { describe, expect, test } from "bun:test";

import { AI_CRAWLERS, CONTENT_SIGNAL, robotsTxt } from "./robots";

const text = robotsTxt(new URL("https://digest.law/"));

/**
 * RFC 9309 groups: one or more User-agent lines, then the rules that follow.
 * A crawler obeys only the group that names it (or `*` if none does), so
 * every rule has to be in every group that matters.
 */
function groups(robots: string): { agents: string[]; rules: string[] }[] {
  const found: { agents: string[]; rules: string[] }[] = [];
  let current: { agents: string[]; rules: string[] } | undefined;
  for (const line of robots.split("\n")) {
    const [field = "", ...rest] = line.split(":"),
      value = rest.join(":").trim();
    if (field.toLowerCase() === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        found.push(current);
      }
      current.agents.push(value);
    } else if (
      current &&
      line.trim() &&
      !line.startsWith("#") &&
      field.toLowerCase() !== "sitemap"
    ) {
      current.rules.push(line.trim());
    }
  }
  return found;
}

function rulesFor(robots: string, agent: string): string[] {
  return (
    groups(robots).find((group) => group.agents.includes(agent))?.rules ?? []
  );
}

describe("robots.txt", () => {
  test("names the sitemap index absolutely", () => {
    expect(text).toContain("Sitemap: https://digest.law/sitemap-index.xml");
  });

  test.each(["*", ...AI_CRAWLERS])(
    "%s gets the whole policy: allow, keep out of /api/, Content Signals",
    (agent) => {
      expect(rulesFor(text, agent)).toEqual([
        "Allow: /",
        "Disallow: /api/",
        `Content-Signal: ${CONTENT_SIGNAL}`,
      ]);
    }
  );

  test("names each crawler once", () => {
    const named = groups(text).flatMap((group) => group.agents);
    expect(named).toHaveLength(new Set(named).size);
  });

  test("lists the AI crawlers the agent-readiness scan looks for", () => {
    for (const bot of [
      "GPTBot",
      "ClaudeBot",
      "Google-Extended",
      "PerplexityBot",
      "CCBot",
    ]) {
      expect(AI_CRAWLERS).toContain(bot);
    }
  });
});
