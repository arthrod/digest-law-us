/**
 * robots.txt for digest.law (served by src/pages/robots.txt.ts).
 *
 * The digests are CC BY 4.0 and the retained sources are public legal
 * materials, so the policy is fully permissive, as on live-contracts:
 * search, AI input (answers that cite a page) and AI training are all
 * allowed, stated as Content Signals (contentsignals.org). Only the contact
 * form's endpoint is excluded from crawling. Change the policy here, nowhere
 * else.
 */

/** AI crawlers named explicitly, so the policy does not rest on `*` alone. */
export const AI_CRAWLERS: readonly string[] = [
    // Search and answer engines
    "OAI-SearchBot",
    "ChatGPT-User",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Perplexity-User",
    "Applebot",
    // Training and dataset crawlers
    "GPTBot",
    "ClaudeBot",
    "anthropic-ai",
    "Google-Extended",
    "CCBot",
    "Applebot-Extended",
    "Meta-ExternalAgent",
  ],
  CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

export function robotsTxt(site: URL): string {
  const bots = AI_CRAWLERS.map((bot) => `User-agent: ${bot}\nAllow: /\n`),
    sitemap = new URL("sitemap-index.xml", site).href;
  return [
    "# robots.txt — digest.law",
    "# Digests: CC BY 4.0. Retained sources: public legal materials.",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    "",
    ...bots,
    `Sitemap: ${sitemap}`,
    "",
  ].join("\n");
}
