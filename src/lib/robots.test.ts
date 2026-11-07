/**
 * robots.txt: open to search and AI crawlers, with Content Signals.
 */
import { describe, expect, test } from "bun:test";

import { AI_CRAWLERS, robotsTxt } from "./robots";

const text = robotsTxt(new URL("https://digest.law/"));

describe("robots.txt", () => {
  test("names the sitemap index absolutely", () => {
    expect(text).toContain("Sitemap: https://digest.law/sitemap-index.xml");
  });

  test("declares Content Signals for every user agent", () => {
    expect(text).toMatch(
      /User-agent: \*\nAllow: \/\nDisallow: \/api\/\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\n/u
    );
  });

  test.each([...AI_CRAWLERS])("allows %s explicitly", (bot) => {
    expect(text).toContain(`User-agent: ${bot}\nAllow: /\n`);
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
