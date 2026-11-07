import { describe, expect, test } from "bun:test";

import { SITE } from "../config";
import { dateOf } from "./dates";
import {
  articleTags,
  FEED_TITLE,
  OG_IMAGE,
  OG_LOCALE,
  ogImageMeta,
} from "./seo";

const SOF0 = 192,
  SOS = 218;

/**
 * Width and height from a JPEG's SOF0 (baseline) segment, found by walking
 * the segments by their lengths: a byte search could land in an EXIF
 * thumbnail's own SOF0. Null when the image data starts without one (a
 * progressive JPEG has SOF2).
 */
function jpegSize(bytes: Uint8Array): { height: number; width: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // After SOI (255, 216), each segment is 255, marker, then a 2-byte length.
  for (let offset = 2; offset + 4 <= bytes.length;) {
    const marker = bytes[offset + 1];
    if (bytes[offset] !== 255 || marker === SOS) {
      return null;
    }
    if (marker === SOF0) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}

async function fileBytes(relative: string): Promise<Uint8Array> {
  return new Uint8Array(
    await Bun.file(new URL(relative, import.meta.url)).arrayBuffer()
  );
}

/** A segment: 255, marker, a 2-byte length that counts itself, the payload. */
function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [255, marker, Math.floor(length / 256), length % 256, ...payload];
}

/** SOF0's payload: precision, height, width, one component. */
function sof0(height: number, width: number): number[] {
  return [
    8,
    Math.floor(height / 256),
    height % 256,
    Math.floor(width / 256),
    width % 256,
    1,
    1,
    17,
    0,
  ];
}

describe("jpegSize", () => {
  test("skips an EXIF thumbnail's SOF0 to read the image's own", () => {
    // APP1 (EXIF) carries a thumbnail with a SOF0 of its own, 10x20.
    const bytes = new Uint8Array([
      255,
      216,
      ...segment(225, [255, SOF0, ...sof0(10, 20).slice(0, 5)]),
      ...segment(SOF0, sof0(630, 1200)),
      ...segment(SOS, [0]),
    ]);
    expect(jpegSize(bytes)).toEqual({ height: 630, width: 1200 });
  });

  test("a progressive JPEG, without SOF0, has no baseline size", () => {
    const bytes = new Uint8Array([
      255,
      216,
      ...segment(194, sof0(630, 1200)),
      ...segment(SOS, [0]),
    ]);
    expect(jpegSize(bytes)).toBeNull();
  });
});

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
    expect(SITE.ogImage).toBe("default-og.jpg");
    expect(jpegSize(await fileBytes(`../../public/${SITE.ogImage}`))).toEqual({
      height: OG_IMAGE.height,
      width: OG_IMAGE.width,
    });
    expect(OG_IMAGE.alt.length).toBeGreaterThan(0);
  });

  test("the default image has that size and alt text", () => {
    expect(ogImageMeta(`/${SITE.ogImage}`)).toEqual(OG_IMAGE);
  });

  test("an image a page brings has neither: they are not known", () => {
    expect(ogImageMeta("/custom.png")).toBeNull();
  });

  test("English (US) locale and the feed's own title", () => {
    expect(OG_LOCALE).toBe("en_US");
    expect(FEED_TITLE).toBe("American Legal Digest — recently revised");
  });
});
