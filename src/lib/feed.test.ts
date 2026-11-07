import { describe, expect, test } from "bun:test";

import { getRssString } from "@astrojs/rss";

import type { TreeNode } from "./corpus";
import {
  digestDescription,
  FEED_SIZE,
  feedDigests,
  feedOptions,
  ledeOf,
  recentlyRevised,
  revisedAt,
  withLedes,
} from "./feed";
import type { FeedDigest } from "./feed";

const SITE = "https://digest.law/";

function digest(slugPath: string, dates: Partial<FeedDigest> = {}): FeedDigest {
  return {
    area: "Evidence Law",
    definition: "",
    description: `About ${slugPath}.`,
    label: slugPath.split("/").at(-1) ?? slugPath,
    modified: "2026-10-01",
    slugPath,
    ...dates,
  };
}

/** A tree node with just the fields feedDigests and withLedes read. */
function node(
  slugPath: string,
  label: string,
  data?: Record<string, unknown>,
  html?: string
): TreeNode {
  return {
    digest: data ? { data, rendered: html ? { html } : undefined } : undefined,
    label,
    slugPath,
  } as unknown as TreeNode;
}

function itemsOf(xml: string): string[] {
  return [...xml.matchAll(/<item>(?<body>.*?)<\/item>/gsu)].map(
    (match) => match.groups?.body ?? ""
  );
}

// oxlint-disable-next-line eslint/one-var -- rendered once for the whole file, after the helpers above
const sample = recentlyRevised([
    digest("evidence-law/proof-of-writings", {
      description: "Rules for proving a writing & its contents.",
      modified: "2026-11-04",
      timestamp: "2026-11-04T10:00:00Z",
    }),
    digest("evidence-law/hearsay", { modified: "2026-10-30" }),
  ]),
  // oxlint-disable-next-line eslint/sort-vars -- xml renders sample, items reads xml (TDZ)
  xml = await getRssString(feedOptions(sample)),
  // oxlint-disable-next-line eslint/sort-vars -- items are read from xml (TDZ)
  items = itemsOf(xml);

describe("revisedAt", () => {
  test.each([
    [
      "a modified day alone",
      "2026-10-02",
      undefined,
      "2026-10-02T00:00:00.000Z",
    ],
    [
      "a same-day timestamp gives the time",
      "2026-10-02",
      "2026-10-02T14:30:00Z",
      "2026-10-02T14:30:00.000Z",
    ],
    [
      "an older generation timestamp does not pull the date back",
      "2026-08-04",
      "2026-07-31T00:21:51Z",
      "2026-08-04T00:00:00.000Z",
    ],
    [
      "a timestamp alone",
      undefined,
      "2026-09-09T09:09:09Z",
      "2026-09-09T09:09:09.000Z",
    ],
    [
      "a modified date-time is taken as is",
      "2026-10-02T08:00:00Z",
      undefined,
      "2026-10-02T08:00:00.000Z",
    ],
    [
      "an unreadable modified falls back to the timestamp",
      "soon",
      "2026-09-09T09:09:09Z",
      "2026-09-09T09:09:09.000Z",
    ],
  ])("%s", (_label, modified, timestamp, expected) => {
    expect(revisedAt(modified, timestamp)?.toISOString()).toBe(expected);
  });

  test.each([
    ["no dates", undefined, undefined],
    ["empty strings", "", ""],
    ["unreadable dates", "2026-13-45", "yesterday"],
    [
      "a day that does not exist (Date would roll it to March)",
      "2026-02-30",
      undefined,
    ],
  ])("%s give no date", (_label, modified, timestamp) => {
    expect(revisedAt(modified, timestamp)).toBeNull();
  });
});

describe("recentlyRevised", () => {
  test("newest first, ties broken by path", () => {
    const entries = recentlyRevised([
      digest("a/old", { modified: "2026-07-01" }),
      digest("a/zeta", { modified: "2026-11-04" }),
      digest("a/alpha", { modified: "2026-11-04" }),
      digest("a/timed", {
        modified: "2026-11-04",
        timestamp: "2026-11-04T10:00:00Z",
      }),
    ]);
    expect(entries.map((entry) => entry.slugPath)).toEqual([
      "a/timed",
      "a/alpha",
      "a/zeta",
      "a/old",
    ]);
  });

  test(`keeps the ${FEED_SIZE} newest`, () => {
    const many = Array.from({ length: FEED_SIZE + 10 }, (_, index) =>
        digest(`a/d${String(index).padStart(3, "0")}`, {
          modified: `2026-10-01T00:${String(index).padStart(2, "0")}:00Z`,
        })
      ),
      // oxlint-disable-next-line eslint/sort-vars -- ranked reads many (TDZ)
      ranked = recentlyRevised(many);
    expect(ranked).toHaveLength(FEED_SIZE);
    expect(ranked[0]?.slugPath).toBe("a/d059");
    expect(ranked.at(-1)?.slugPath).toBe("a/d010");
  });

  test("a digest with no readable date is left out", () => {
    const entries = recentlyRevised([
      digest("a/dated"),
      digest("a/undated", { modified: undefined }),
    ]);
    expect(entries.map((entry) => entry.slugPath)).toEqual(["a/dated"]);
  });
});

describe("digestDescription", () => {
  const base = { area: "Evidence Law", label: "Proof of writings" };

  test.each([
    ["the description first", "Said.", "Defined.", "Opens.", "Said."],
    ["then the definition", "", "Defined.", "Opens.", "Defined."],
    ["then the digest's opening paragraph", "", "", "Opens.", "Opens."],
    [
      "then the page's own fallback",
      "",
      "",
      undefined,
      "Digest of Proof of writings in Evidence Law, with retained sources and audit.",
    ],
  ])("%s", (_label, description, definition, lede, expected) => {
    expect(digestDescription({ ...base, definition, description, lede })).toBe(
      expected
    );
  });
});

describe("ledeOf", () => {
  test.each([
    [
      "the first paragraph, after the headings",
      "<h1>Title</h1><h2>Introduction</h2><p>The first.</p><p>The second.</p>",
      "The first.",
    ],
    [
      "inline markup is dropped",
      '<p>The <em>watered stock</em> rule, see <a href="/x/">§ 1</a>.</p>',
      "The watered stock rule, see § 1.",
    ],
    [
      "entities are decoded once",
      "<p>Smith &amp; Jones &lt;1990&gt; &quot;held&quot; it&#39;s &#x27;void&#x27;&nbsp;&amp;amp;</p>",
      "Smith & Jones <1990> \"held\" it's 'void' &amp;",
    ],
    [
      "white space is collapsed",
      "<p>\n  One\n   two\tthree  \n</p>",
      "One two three",
    ],
    [
      "a paragraph with attributes counts",
      '<p class="lead">Attributed.</p>',
      "Attributed.",
    ],
    [
      "hexadecimal references decode",
      "<p>&#x201C;Quoted&#x201D; &#xa7; 1</p>",
      "\u201CQuoted\u201D \u00A7 1",
    ],
    [
      "a reference past U+10FFFF is left as written, not thrown on",
      "<p>Odd &#99999999; and &#x110000; here.</p>",
      "Odd &#99999999; and &#x110000; here.",
    ],
    ["no paragraph gives nothing", "<h1>Only a title</h1>", ""],
    ["no html gives nothing", undefined, ""],
  ])("%s", (_label, html, expected) => {
    expect(ledeOf(html)).toBe(expected);
  });

  test("a long paragraph is cut at a word, under 280 characters", () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`),
      // oxlint-disable-next-line eslint/sort-vars -- lede reads words (TDZ)
      lede = ledeOf(`<p>${words.join(" ")}</p>`);
    expect(lede.length).toBeLessThanOrEqual(280);
    expect(lede.endsWith("…")).toBe(true);
    expect(words.join(" ").startsWith(lede.slice(0, -1))).toBe(true);
    expect(lede.at(-2)).not.toBe(" ");
    expect(words).toContain(lede.slice(0, -1).split(" ").at(-1));
  });
});

describe("feedDigests", () => {
  test("reads every digest node, with its area's label", () => {
    const nodes = new Map<string, TreeNode>([
        ["evidence-law", node("evidence-law", "Evidence Law")],
        [
          "evidence-law/proof-of-writings",
          node("evidence-law/proof-of-writings", "Proof of writings", {
            definition: "Defined.",
            description: "",
            modified: "2026-11-04",
            timestamp: "2026-11-04T10:00:00Z",
          }),
        ],
        ["orphan-area/topic", node("orphan-area/topic", "Topic", {})],
      ]),
      // oxlint-disable-next-line eslint/sort-vars -- digests reads nodes (TDZ)
      digests = feedDigests({ nodeBySlugPath: nodes });
    expect(digests).toEqual([
      {
        area: "Evidence Law",
        definition: "Defined.",
        description: "",
        label: "Proof of writings",
        modified: "2026-11-04",
        slugPath: "evidence-law/proof-of-writings",
        timestamp: "2026-11-04T10:00:00Z",
      },
      {
        area: "orphan-area",
        definition: "",
        description: "",
        label: "Topic",
        modified: undefined,
        slugPath: "orphan-area/topic",
        timestamp: undefined,
      },
    ]);
  });

  test("a description shared with another digest is boilerplate, so it is dropped", () => {
    const shared = "Derived from retained sources of the research run.",
      // oxlint-disable-next-line eslint/sort-vars -- nodes read shared (TDZ)
      nodes = new Map<string, TreeNode>([
        ["a/one", node("a/one", "One", { description: shared })],
        ["a/two", node("a/two", "Two", { description: shared })],
        ["a/own", node("a/own", "Own", { description: "Its own." })],
      ]),
      // oxlint-disable-next-line eslint/sort-vars -- descriptions read nodes (TDZ)
      descriptions = feedDigests({ nodeBySlugPath: nodes }).map(
        (entry) => entry.description
      );
    expect(descriptions).toEqual(["", "", "Its own."]);
  });
});

describe("withLedes", () => {
  test("reads the opening paragraph of each chosen digest", () => {
    const nodes = new Map<string, TreeNode>([
        [
          "a/one",
          node("a/one", "One", {}, "<h1>One</h1><p>One opens here.</p>"),
        ],
        ["a/bare", node("a/bare", "Bare", {})],
      ]),
      // oxlint-disable-next-line eslint/sort-vars -- ledes read nodes (TDZ)
      ledes = withLedes(
        recentlyRevised([digest("a/one"), digest("a/bare"), digest("a/gone")]),
        { nodeBySlugPath: nodes }
      ).map((entry) => [entry.slugPath, entry.lede]);
    expect(ledes).toEqual([
      ["a/bare", ""],
      ["a/gone", ""],
      ["a/one", "One opens here."],
    ]);
  });
});

describe("the RSS document", () => {
  test("is a channel for the site, in English, that names itself", () => {
    expect(xml).toContain("<link>https://digest.law/</link>");
    expect(xml).toContain("<language>en-us</language>");
    expect(xml).toContain(
      '<atom:link href="https://digest.law/rss.xml" rel="self" type="application/rss+xml"/>'
    );
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  });

  test("its description counts the items it holds, not the size it aims for", () => {
    expect(items).toHaveLength(2);
    expect(xml).toContain(
      "<description>The 2 most recently revised digests in the American Legal Digest"
    );
    expect(xml).not.toContain(`The ${FEED_SIZE} most recently`);
  });

  test("its build date is the newest revision, not the time of the build", () => {
    expect(xml).toContain(
      "<lastBuildDate>Wed, 04 Nov 2026 10:00:00 GMT</lastBuildDate>"
    );
  });

  test("lists the entries in order, each linking to its page", () => {
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("<title>proof-of-writings</title>");
    expect(items[0]).toContain(
      `<link>${SITE}evidence-law/proof-of-writings/</link>`
    );
    expect(items[0]).toContain(
      "<pubDate>Wed, 04 Nov 2026 10:00:00 GMT</pubDate>"
    );
    expect(items[0]).toContain("<category>Evidence Law</category>");
    expect(items[1]).toContain(`<link>${SITE}evidence-law/hearsay/</link>`);
  });

  test("escapes the description", () => {
    expect(items[0]).toContain(
      "<description>Rules for proving a writing &amp; its contents.</description>"
    );
  });

  test("each revision has its own guid, so a revised digest shows again", () => {
    expect(items[0]?.match(/<guid/gu)).toHaveLength(1);
    expect(items[0]).toContain(
      `<guid isPermaLink="false">${SITE}evidence-law/proof-of-writings/#revised-2026-11-04</guid>`
    );
  });

  test("a digest with no description of its own is described by its lede", async () => {
    const entries = recentlyRevised([
        digest("a/lede", { description: "", lede: "It opens like this." }),
      ]),
      rendered = await getRssString(feedOptions(entries));
    expect(itemsOf(rendered)[0]).toContain(
      "<description>It opens like this.</description>"
    );
  });

  test("an empty corpus still renders a valid channel", async () => {
    const empty = await getRssString(feedOptions([]));
    expect(itemsOf(empty)).toHaveLength(0);
    expect(empty).not.toContain("<lastBuildDate>");
  });
});

describe("the feed's content type", () => {
  test("_headers serves /rss.xml as application/rss+xml", async () => {
    const headers = await Bun.file(
      new URL("../../public/_headers", import.meta.url)
    ).text();
    expect(headers).toMatch(
      /^\/rss\.xml\n {2}Content-Type: application\/rss\+xml; charset=utf-8$/mu
    );
  });

  test("the route renders the feed from the corpus", async () => {
    const route = await Bun.file(
      new URL("../pages/rss.xml.ts", import.meta.url)
    ).text();
    expect(route).toContain("feedOptions(");
    expect(route).toContain("withLedes(recentlyRevised(feedDigests(");
  });
});
