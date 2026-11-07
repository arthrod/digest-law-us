import { describe, expect, test } from "bun:test";

import { dateOf } from "./dates";
import { articleTags, FEED_TITLE, OG_IMAGE, OG_LOCALE } from "./seo";

/** Width and height from a baseline JPEG's SOF0 segment (bytes 255, 192). */
async function jpegSize(
  relative: string
): Promise<{ height: number; width: number }> {
  const bytes = new Uint8Array(
      await Bun.file(new URL(relative, import.meta.url)).arrayBuffer()
    ),
    sof = bytes.findIndex(
      (byte, index) => byte === 255 && bytes[index + 1] === 192
    ),
    // oxlint-disable-next-line eslint/sort-vars -- view reads bytes (TDZ)
    view = new DataView(bytes.buffer);
  return { height: view.getUint16(sof + 5), width: view.getUint16(sof + 7) };
}

describe("dateOf", () => {
  test.each([
    ["a day", "2026-11-04", "2026-11-04T00:00:00.000Z"],
    ["a date-time", "2026-11-04T10:00:00Z", "2026-11-04T10:00:00.000Z"],
  ])("reads %s", (_label, text, iso) => {
    expect(dateOf(text)?.toISOString()).toBe(iso);
  });

  test.each([
    ["nothing", undefined],
    ["an empty string", ""],
    ["words", "soon"],
    ["a month that does not exist", "2026-13-01"],
    ["a day that does not exist", "2026-02-30"],
  ])("gives null for %s", (_label, text) => {
    expect(dateOf(text)).toBeNull();
  });
});

describe("articleTags", () => {
  test("a digest's revision days and area", () => {
    expect(
      articleTags({
        modified: "2026-11-04",
        published: "2026-08-07",
        section: "Evidence Law",
      })
    ).toEqual([
      { content: "2026-08-07", property: "article:published_time" },
      { content: "2026-11-04", property: "article:modified_time" },
      { content: "Evidence Law", property: "article:section" },
    ]);
  });

  test("a date-time stays a date-time", () => {
    expect(articleTags({ modified: "2026-11-04T10:00:00Z" })).toEqual([
      {
        content: "2026-11-04T10:00:00.000Z",
        property: "article:modified_time",
      },
    ]);
  });

  test("unreadable dates and an empty section are left out", () => {
    expect(
      articleTags({ modified: "2026-02-30", published: "soon", section: "" })
    ).toEqual([]);
  });

  test("no article, no tags", () => {
    expect(articleTags()).toEqual([]);
  });
});

describe("site-wide head values", () => {
  test("the default image is the 1200x630 default-og.jpg, with alt text", async () => {
    expect(await jpegSize("../../public/default-og.jpg")).toEqual({
      height: OG_IMAGE.height,
      width: OG_IMAGE.width,
    });
    expect(OG_IMAGE.alt.length).toBeGreaterThan(0);
  });

  test("English (US) locale and the feed's own title", () => {
    expect(OG_LOCALE).toBe("en_US");
    expect(FEED_TITLE).toBe("American Legal Digest — recently revised");
  });
});
