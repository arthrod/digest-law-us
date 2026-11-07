/**
 * Built-page heads that pass every check in head-check.ts, for its tests and
 * for scripts/check-head.test.ts. Each test removes or corrupts one tag.
 */
/* oxlint-disable eslint/sort-vars -- fixtures are declared in dependency order: each head is built from the tags above it (TDZ) */
export const SITE = "https://digest.law/",
  ARTICLE = {
    "@context": "https://schema.org",
    "@type": "Article",
    dateModified: "2026-11-04",
    description: "Rules for proving a writing & its contents.",
    headline: "Proof of writings",
    inLanguage: "en",
    license: "https://creativecommons.org/licenses/by/4.0/",
    publisher: {
      "@type": "Organization",
      name: "American Legal Digest",
      url: SITE,
    },
  },
  CRUMBS = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", item: SITE, name: "Digest", position: 1 },
      {
        "@type": "ListItem",
        item: `${SITE}evidence-law/`,
        name: "Evidence Law",
        position: 2,
      },
      { "@type": "ListItem", name: "Proof of writings", position: 3 },
    ],
  },
  WEBSITE = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "American Legal Digest",
    potentialAction: {
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
      target: `${SITE}search/?q={search_term_string}`,
    },
    url: SITE,
  },
  ORGANIZATION = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "American Legal Digest",
    url: SITE,
  },
  ld = (value: unknown): string =>
    `<script type="application/ld+json">${JSON.stringify(value)}</script>`,
  BASE = [
    `<link href="${SITE}evidence-law/proof-of-writings/" rel="canonical">`,
    '<meta content="Rules for proving a writing &amp; its contents." name="description">',
    '<meta content="Rules for proving a writing &amp; its contents." property="og:description">',
    '<meta content="Rules for proving a writing &amp; its contents." property="twitter:description">',
    '<meta content="en_US" property="og:locale">',
    `<meta content="${SITE}default-og.jpg" property="og:image">`,
    '<meta content="1200" property="og:image:width">',
    '<meta content="630" property="og:image:height">',
    '<meta content="American Legal Digest" property="og:image:alt">',
    '<link href="/rss.xml" rel="alternate" title="American Legal Digest — recently revised" type="application/rss+xml">',
    '<script defer src="/webmcp.js"></script>',
  ],
  DIGEST_HEAD = [
    ...BASE,
    '<meta content="article" property="og:type">',
    '<meta content="2026-11-04" property="article:modified_time">',
    '<meta content="Evidence Law" property="article:section">',
    ld(ARTICLE),
  ],
  HOME_HEAD = [
    ...BASE,
    '<meta content="website" property="og:type">',
    ld(WEBSITE),
    ld(ORGANIZATION),
  ],
  PAGE_HEAD = [...BASE, '<meta content="website" property="og:type">'];

export function html(head: string[], body: string[] = []): string {
  return `<!doctype html><html lang="en"><head>\n${head.join("\n")}\n</head><body><main><p>Text.</p>${body.join("")}</main></body></html>`;
}
