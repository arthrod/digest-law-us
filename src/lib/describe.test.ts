import { describe, expect, test } from "bun:test";

import {
  BOILERPLATE,
  describeDigest,
  isBoilerplate,
  ledeOf,
  META_MAX,
} from "./describe";

const PROVISIONAL =
  "Provisional synthesis — no primary authority was retained by this run. Verify claims against official jurisdiction-specific sources before relying on this digest.";

describe("describeDigest", () => {
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
    expect(describeDigest({ ...base, definition, description, lede })).toBe(
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
    [
      "a reference to a character XML cannot carry stays as written",
      "<p>A &#0; B &#x1; C &#xD800; D &#xFFFE; E</p>",
      "A &#0; B &#x1; C &#xD800; D &#xFFFE; E",
    ],
    [
      "an empty paragraph is passed over",
      '<p></p><p> &nbsp; </p><p><img src="x.png" alt=""></p><p>The first words.</p>',
      "The first words.",
    ],
    [
      "a paragraph quoted, in a figure, aside or details is not the lede",
      "<blockquote><p>Quoted.</p></blockquote><figure><p>Figure.</p></figure><aside><p>Aside.</p></aside><details><summary>More</summary><p>Hidden.</p></details><p>The digest's own.</p>",
      "The digest's own.",
    ],
    [
      "a nested quotation is passed over whole",
      "<blockquote><blockquote><p>Inner.</p></blockquote><p>Outer.</p></blockquote><p>Own.</p>",
      "Own.",
    ],
    [
      "a > inside a quoted attribute does not end the tag",
      '<p>See <a title="a > b" href="/x/">the rule</a>.</p>',
      "See the rule.",
    ],
    [
      "a tag that only starts with p is not a paragraph",
      '<picture><source srcset="x"></picture><param name="a"><p>Real.</p>',
      "Real.",
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

  test.each([
    ["the feed's", undefined],
    ["a meta description's", META_MAX],
  ])("a cut at %s length never splits a character in two", (_label, max) => {
    const lede = ledeOf(`<p>${"\u{1F600}".repeat(300)}</p>`, max);
    expect(lede.endsWith("…")).toBe(true);
    expect(lede.isWellFormed()).toBe(true);
  });
});

describe("isBoilerplate", () => {
  test.each([
    [
      "the research run's sentence",
      "Derived from retained sources of the research run.",
    ],
    ["a provisional-synthesis caveat", PROVISIONAL],
    [
      "another wording of the caveat",
      "Provisional synthesis — sparse retained primary authority (2 sources). Verify claims against official jurisdiction-specific sources before relying on this digest.",
    ],
    ["an empty description", ""],
    ["white space", "  \n"],
  ])("%s is boilerplate", (_label, text) => {
    expect(isBoilerplate(text)).toBe(true);
  });

  test.each([
    [
      "a description of the topic",
      "Rules for proving a writing and its contents.",
    ],
    [
      "one that mentions a provisional synthesis",
      "When a provisional synthesis binds.",
    ],
  ])("%s is not", (_label, text) => {
    expect(isBoilerplate(text)).toBe(false);
  });
});

describe("describeDigest skips boilerplate", () => {
  const base = { area: "Evidence Law", label: "Proof of writings" };

  test.each([
    ["the definition", BOILERPLATE[0], "Defined.", "Opens.", "Defined."],
    ["the opening paragraph", PROVISIONAL, "", "Opens.", "Opens."],
    [
      "the generic sentence",
      PROVISIONAL,
      "",
      "",
      "Digest of Proof of writings in Evidence Law, with retained sources and audit.",
    ],
  ])(
    "a boilerplate description gives way to %s",
    (_label, description, definition, lede, expected) => {
      expect(describeDigest({ ...base, definition, description, lede })).toBe(
        expected
      );
    }
  );
});

describe("ledeOf for a meta description", () => {
  test("is cut at a word, within 160 characters", () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`),
      // oxlint-disable-next-line eslint/sort-vars -- lede reads words (TDZ)
      lede = ledeOf(`<p>${words.join(" ")}</p>`, META_MAX);
    expect(META_MAX).toBe(160);
    expect(lede.length).toBeLessThanOrEqual(160);
    expect(lede.length).toBeGreaterThan(140);
    expect(lede.endsWith("…")).toBe(true);
    expect(words).toContain(lede.slice(0, -1).split(" ").at(-1));
  });
});

describe("the digest page", () => {
  test("describes its head with describeDigest, and keeps its visible line", async () => {
    const view = await Bun.file(
      new URL("../components/views/DigestView.astro", import.meta.url)
    ).text();
    expect(view).toContain("metaDescription = describeDigest({");
    expect(view).toContain("lede: ledeOf(digest.rendered?.html, META_MAX)");
    expect(view).toContain("description={metaDescription}");
    expect(view).toContain("description: metaDescription,");
    // The line under the title is unchanged: the lede is already the page's
    // first paragraph, so it would print twice.
    expect(view).toContain("{description}\n          </p>");
  });
});
