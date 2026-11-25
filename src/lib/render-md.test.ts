import { describe, expect, test } from "bun:test";

import { renderCorpusFile, renderSourceChunk } from "./render-md";

const GONE = "no-such-bundle/sources/deleted-mid-build.md";

describe("render-md with a file deleted from the corpus", () => {
  test("every part of a deleted source renders the notice", async () => {
    const first = await renderSourceChunk(GONE, { end: 5000, start: 0 }),
      later = await renderSourceChunk(GONE, { end: 10_000, start: 5000 });
    expect(first.html).toContain("no longer in the corpus");
    expect(later.html).toContain("no longer in the corpus");
  });

  test("a deleted audit file renders the notice", async () => {
    expect(await renderCorpusFile(GONE)).toContain("no longer in the corpus");
  });
});
