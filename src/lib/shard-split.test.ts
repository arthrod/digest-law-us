import { describe, expect, test } from "bun:test";

import ignore from "ignore";

import { shardIgnoreLines, shardKeyFor, splitUnitOf } from "./shard-split";

describe("splitUnitOf", () => {
  test("a fragment buckets by its first hash character", () => {
    expect(splitUnitOf("pagefind/fragment/en_3a1b2c.pf_fragment")).toBe(
      "pagefind/fragment/en_3"
    );
  });

  test("files outside a split dir are not split", () => {
    expect(splitUnitOf("pagefind/index/en_3a1.pf_index")).toBeUndefined();
    expect(splitUnitOf("contract-law/x/index.html")).toBeUndefined();
  });

  test("a subfolder inside a split dir is refused", () => {
    expect(() =>
      splitUnitOf("pagefind/fragment/sub/en_1.pf_fragment")
    ).toThrow();
  });
});

describe("shardKeyFor", () => {
  const map = {
    contract: "SHARD_B",
    pagefind: "SHARD_K",
    "pagefind/fragment/en_3": "SHARD_L",
  };

  test("the longest matching split prefix wins", () => {
    expect(shardKeyFor(map, "/pagefind/fragment/en_3ab.pf_fragment")).toBe(
      "SHARD_L"
    );
  });

  test("other pagefind files go to the folder's shard", () => {
    expect(shardKeyFor(map, "/pagefind/index/en_3ab.pf_index")).toBe("SHARD_K");
    expect(shardKeyFor(map, "/pagefind/fragment/en_4ab.pf_fragment")).toBe(
      "SHARD_K"
    );
  });

  test("only an exact first segment forwards a folder", () => {
    expect(shardKeyFor(map, "/contract/x/")).toBe("SHARD_B");
    expect(shardKeyFor(map, "/contract-law/x/")).toBeUndefined();
    expect(shardKeyFor(map, "/pagefind-ui.js")).toBeUndefined();
    expect(shardKeyFor(undefined, "/contract/x/")).toBeUndefined();
  });
});

describe("shardIgnoreLines", () => {
  test("plain folders are whitelisted as before", () => {
    expect(shardIgnoreLines(["about", "contract-law"])).toEqual([
      "/*",
      "!/404.html",
      "!/about/",
      "!/contract-law/",
    ]);
  });

  test("the split folder keeps everything but the split dir's files", () => {
    expect(shardIgnoreLines(["pagefind"])).toEqual([
      "/*",
      "!/404.html",
      "!/pagefind/",
      "/pagefind/fragment/*",
    ]);
  });

  test("buckets alone re-open just their files", () => {
    expect(
      shardIgnoreLines(["pagefind/fragment/en_1", "pagefind/fragment/en_2"])
    ).toEqual([
      "/*",
      "!/404.html",
      "!/pagefind/",
      "/pagefind/*",
      "!/pagefind/fragment/",
      "/pagefind/fragment/*",
      "!/pagefind/fragment/en_1*",
      "!/pagefind/fragment/en_2*",
    ]);
  });

  test("the folder and some buckets together", () => {
    expect(shardIgnoreLines(["pagefind", "pagefind/fragment/en_1"])).toEqual([
      "/*",
      "!/404.html",
      "!/pagefind/",
      "/pagefind/fragment/*",
      "!/pagefind/fragment/en_1*",
    ]);
  });
});

// Exact strings above pin the rules; these pin what they mean, through the
// gitignore engine wrangler bundles (ignore@5.3.1) — rule order and
// directory re-inclusion are where a plausible string goes wrong.
describe("shardIgnoreLines membership (wrangler's ignore engine)", () => {
  const FILES = [
      "404.html",
      "index.html",
      "contract-law/a/index.html",
      "pagefind/pagefind.js",
      "pagefind/index/en_1x.pf_index",
      "pagefind/fragment/en_1ab.pf_fragment",
      "pagefind/fragment/en_2ab.pf_fragment",
    ],
    shipped = (units: string[]) => {
      // wrangler always prepends its own metafile rules.
      const engine = ignore().add([
        "/.assetsignore",
        "/_redirects",
        "/_headers",
        ...shardIgnoreLines(units),
      ]);
      return FILES.filter((file) => !engine.ignores(file));
    };

  test("the split folder alone ships everything but its fragments", () => {
    expect(shipped(["pagefind"])).toEqual([
      "404.html",
      "pagefind/pagefind.js",
      "pagefind/index/en_1x.pf_index",
    ]);
  });

  test("a bucket alone ships only its own fragments", () => {
    expect(shipped(["pagefind/fragment/en_1"])).toEqual([
      "404.html",
      "pagefind/fragment/en_1ab.pf_fragment",
    ]);
  });

  test("the folder plus a bucket ships both, not the other bucket", () => {
    expect(shipped(["pagefind", "pagefind/fragment/en_2"])).toEqual([
      "404.html",
      "pagefind/pagefind.js",
      "pagefind/index/en_1x.pf_index",
      "pagefind/fragment/en_2ab.pf_fragment",
    ]);
  });

  test("a plain folder shard ships no pagefind file", () => {
    expect(shipped(["contract-law"])).toEqual([
      "404.html",
      "contract-law/a/index.html",
    ]);
  });
});
