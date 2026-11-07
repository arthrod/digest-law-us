/**
 * schema.org JSON-LD: the site-level builders in schema-org.ts and the
 * Article in skos.ts, each checked on its own and then against the rules
 * scripts/check-head.ts applies to built pages.
 */
import { describe, expect, test } from "bun:test";

import type { TreeNode } from "./corpus";
import { headProblems } from "./head-check";
import { BASE, html } from "./head-check.fixtures";
import {
  breadcrumbJsonLd,
  CONTENT_LICENSE,
  ORGANIZATION,
  organizationJsonLd,
  SEARCH_URL_TEMPLATE,
  websiteJsonLd,
} from "./schema-org";
import { articleJsonLd } from "./skos";

const SITE = "https://digest.law/",
  TRAIL = [
    { href: "/", label: "Digest" },
    { href: "/evidence-law/", label: "Evidence Law" },
    { label: "Proof of writings" },
  ];

function parsed(json: string | null): unknown {
  return JSON.parse(json ?? "null");
}

function script(json: string | null): string {
  return `<script type="application/ld+json">${json ?? ""}</script>`;
}

function digestNode(slugPath: string, label: string): TreeNode {
  return { label, slugPath } as unknown as TreeNode;
}

function article(dates: { dateModified?: string; datePublished?: string }) {
  return articleJsonLd(
    digestNode("evidence-law/proof-of-writings", "Proof of writings"),
    {
      description: "Rules for proving a writing.",
      sourceUrls: [],
      ...dates,
    }
  );
}

async function source(relative: string): Promise<string> {
  return await Bun.file(new URL(relative, import.meta.url)).text();
}

describe("breadcrumbJsonLd", () => {
  test("positions run 1..n, crumbs link absolutely, the current page is last and unlinked", () => {
    expect(parsed(breadcrumbJsonLd(TRAIL))).toEqual({
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
    });
  });

  test("a crumb with no page before the last is left out, and positions close up", () => {
    const list = parsed(
      breadcrumbJsonLd([
        { href: "/", label: "Digest" },
        { label: "Unpublished folder" },
        { label: "Here" },
      ])
    );
    expect(list).toMatchObject({
      itemListElement: [
        { item: SITE, name: "Digest", position: 1 },
        { name: "Here", position: 2 },
      ],
    });
  });

  test.each([
    ["no crumbs", []],
    ["one crumb", [{ label: "Only" }]],
    ["no crumb with a page", [{ label: "Folder" }, { label: "Here" }]],
  ])("%s is no trail", (_label, crumbs) => {
    expect(breadcrumbJsonLd(crumbs)).toBeNull();
  });

  test("a label cannot close the <script> element", () => {
    const label = "A </script><script>alert(1)</script> b",
      rendered = breadcrumbJsonLd([{ href: "/", label: "Digest" }, { label }]);
    expect(rendered).not.toContain("</script");
    expect(parsed(rendered)).toMatchObject({
      itemListElement: [{}, { name: label }],
    });
  });
});

describe("websiteJsonLd", () => {
  test("names the site and how to search it", () => {
    expect(parsed(websiteJsonLd())).toEqual({
      "@context": "https://schema.org",
      "@id": `${SITE}#website`,
      "@type": "WebSite",
      inLanguage: "en",
      name: "American Legal Digest",
      potentialAction: {
        "@type": "SearchAction",
        "query-input": "required name=search_term_string",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE}search/?q={search_term_string}`,
        },
      },
      publisher: { "@id": `${SITE}#organization` },
      url: SITE,
    });
  });

  test("the search page runs the q parameter the action fills", async () => {
    expect(SEARCH_URL_TEMPLATE).toBe(`${SITE}search/?q={search_term_string}`);
    expect(await source("../pages/search.astro")).toContain(
      'query = params.get("q")'
    );
  });
});

describe("organizationJsonLd", () => {
  test("names the publisher, its site and its logo", () => {
    expect(parsed(organizationJsonLd())).toEqual({
      "@context": "https://schema.org",
      "@id": `${SITE}#organization`,
      "@type": "Organization",
      logo: `${SITE}favicon.svg`,
      name: "American Legal Digest",
      url: SITE,
    });
  });

  test("the logo is a file the site serves", async () => {
    const file = ORGANIZATION.logo.replace(SITE, "../../public/");
    expect(await Bun.file(new URL(file, import.meta.url)).exists()).toBe(true);
  });
});

describe("articleJsonLd", () => {
  test("carries the license, publisher, language, image and both dates", () => {
    expect(
      parsed(
        article({ dateModified: "2026-11-04", datePublished: "2026-08-07" })
      )
    ).toMatchObject({
      "@type": "Article",
      author: ORGANIZATION,
      dateModified: "2026-11-04",
      datePublished: "2026-08-07",
      headline: "Proof of writings",
      image: `${SITE}default-og.jpg`,
      inLanguage: "en",
      license: "https://creativecommons.org/licenses/by/4.0/",
      mainEntityOfPage: `${SITE}evidence-law/proof-of-writings/`,
      publisher: ORGANIZATION,
    });
  });

  test("a date-time is kept as a UTC date-time, like article:modified_time", () => {
    expect(
      parsed(article({ dateModified: "2026-11-04T10:00:00-05:00" }))
    ).toMatchObject({
      dateModified: "2026-11-04T15:00:00.000Z",
    });
  });

  test("dates that do not exist are left out", () => {
    const json = parsed(
      article({ dateModified: "2026-02-30", datePublished: "soon" })
    );
    expect(json).not.toHaveProperty("dateModified");
    expect(json).not.toHaveProperty("datePublished");
  });

  test("the license is the one the footer declares", async () => {
    expect(CONTENT_LICENSE).toBe(
      "https://creativecommons.org/licenses/by/4.0/"
    );
    expect(await source("../components/SiteFooter.astro")).toContain(
      `href="${CONTENT_LICENSE}"`
    );
  });
});

describe("the built JSON-LD meets check-head's rules", () => {
  test("a digest page: Article and BreadcrumbList", () => {
    const page = html(
      [
        ...BASE,
        '<meta content="article" property="og:type">',
        '<meta content="2026-11-04" property="article:modified_time">',
        '<meta content="Evidence Law" property="article:section">',
        script(article({ dateModified: "2026-11-04" })),
      ],
      [script(breadcrumbJsonLd(TRAIL))]
    );
    expect(headProblems(page, "digest")).toEqual([]);
  });

  test("the home page: WebSite and Organization", () => {
    const page = html([
      ...BASE,
      '<meta content="website" property="og:type">',
      script(websiteJsonLd()),
      script(organizationJsonLd()),
    ]);
    expect(headProblems(page, "home")).toEqual([]);
  });
});
