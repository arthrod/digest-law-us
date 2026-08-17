/**
 * Cache-key composition for incremental builds (astro.config.ts
 * `experimental.incrementalBuild`). A page is skipped when its cacheKey
 * matches the previous build, so an under-inclusive key ships a stale page
 * silently — these tests pin the properties that keep keys honest:
 * distinct inputs never collide, and every data input moves the key.
 */
import { describe, expect, test } from "bun:test";

import type { EntryLike, KeyNode } from "./cache-keys";
import {
  cacheKeyFrom,
  stampEntry,
  stampRef,
  subtreeStamps,
} from "./cache-keys";

const ref = (over: Partial<Parameters<typeof stampRef>[0]> = {}) => ({
  label: "Sale of Assets",
  published: true,
  slugPath: "bankruptcy/sale-of-assets",
  urn: "urn:legal-taxonomy:issue:bankruptcy.sale_of_assets",
  ...over,
});

function treeNode(over: Partial<KeyNode> = {}): KeyNode {
  return {
    children: [],
    dir: "Bankruptcy/SALE_OF_ASSETS",
    slugPath: "bankruptcy/sale-of-assets",
    ...over,
  };
}

const sources = (bundle: string, entries: EntryLike[]) =>
  new Map([[bundle, entries]]);

describe("cacheKeyFrom", () => {
  test("deterministic for identical input", () => {
    expect(cacheKeyFrom("digest", ["a", "b"])).toBe(
      cacheKeyFrom("digest", ["a", "b"])
    );
  });

  test("scope separates page kinds sharing the same parts", () => {
    const parts = ["Bankruptcy/SALE_OF_ASSETS#abc"];
    expect(cacheKeyFrom("digest", parts)).not.toBe(
      cacheKeyFrom("audit", parts)
    );
  });

  test("part boundaries cannot collide", () => {
    expect(cacheKeyFrom("s", ["ab", "c"])).not.toBe(
      cacheKeyFrom("s", ["a", "bc"])
    );
    expect(cacheKeyFrom("s", ["a"])).not.toBe(cacheKeyFrom("s", ["a", ""]));
  });

  test("order matters", () => {
    expect(cacheKeyFrom("s", ["a", "b"])).not.toBe(
      cacheKeyFrom("s", ["b", "a"])
    );
  });
});

describe("stampEntry", () => {
  test("absence is distinct from any present entry", () => {
    expect(stampEntry(null)).not.toBe(stampEntry({ id: "" }));
    expect(stampEntry(null)).toBe(stampEntry(null));
  });

  test("content digest moves the stamp", () => {
    expect(stampEntry({ digest: "aaa", id: "x/y" })).not.toBe(
      stampEntry({ digest: "bbb", id: "x/y" })
    );
  });

  test("numeric and string digests both register", () => {
    expect(stampEntry({ digest: 1, id: "x" })).not.toBe(
      stampEntry({ digest: 2, id: "x" })
    );
  });
});

describe("stampRef", () => {
  test("publication flip moves the stamp", () => {
    expect(stampRef(ref({ published: true }))).not.toBe(
      stampRef(ref({ published: false }))
    );
  });

  test("resolved label moves the stamp", () => {
    expect(stampRef(ref({ label: "A" }))).not.toBe(
      stampRef(ref({ label: "B" }))
    );
  });
});

describe("subtreeStamps", () => {
  test("a deep descendant's entry digest moves the stamps", () => {
    const grandchild = (digest: string): KeyNode =>
      treeNode({
        children: [
          treeNode({
            children: [
              treeNode({
                digest: { digest, id: "a/b/c/c" },
                dir: "A/B/C",
                slugPath: "a/b/c",
              }),
            ],
            dir: "A/B",
            slugPath: "a/b",
          }),
        ],
        dir: "A",
        slugPath: "a",
      }),
     empty = new Map<string, EntryLike[]>();
    expect(subtreeStamps(grandchild("v1"), empty)).not.toEqual(
      subtreeStamps(grandchild("v2"), empty)
    );
  });

  test("a source added to a child bundle moves the stamps", () => {
    const node = treeNode({
      children: [treeNode({ dir: "A/B", slugPath: "a/b" })],
      dir: "A",
      slugPath: "a",
    }),
     before = subtreeStamps(
      node,
      sources("A/B", [{ digest: "s1", id: "A/B/sources/one" }])
    ),
     after = subtreeStamps(
      node,
      sources("A/B", [
        { digest: "s1", id: "A/B/sources/one" },
        { digest: "s2", id: "A/B/sources/two" },
      ])
    );
    expect(before).not.toEqual(after);
  });

  test("stamps only read the node's own bundle key", () => {
    const node = treeNode({ dir: "A", slugPath: "a" }),
     stamps = subtreeStamps(
      node,
      sources("A/B", [{ digest: "s1", id: "A/B/sources/one" }])
    );
    expect(stamps.join("\n")).not.toContain("A/B/sources/one");
  });

  test("deterministic", () => {
    const node = treeNode({
      children: [treeNode({ dir: "A/B", slugPath: "a/b" })],
      dir: "A",
      slugPath: "a",
    }),
     map = sources("A", [{ digest: "s1", id: "A/sources/one" }]);
    expect(subtreeStamps(node, map)).toEqual(subtreeStamps(node, map));
  });
});
