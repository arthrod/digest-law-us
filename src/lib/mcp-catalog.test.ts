import { describe, expect, test } from "bun:test";

import {
  findConcept,
  listConcepts,
  searchConcepts,
  toCatalog,
  withBuiltPages,
} from "./mcp-catalog";
import type { CatalogSource } from "./mcp-catalog";

const GONE = "cccccccccccccccccccccccccccccccc",
  LIVE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  MERGED = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ROOT = "dddddddddddddddddddddddddddddddd",
  // oxlint-disable-next-line eslint/sort-vars -- RECORDS closes over the ids above
  RECORDS: CatalogSource[] = [
    {
      id: ROOT,
      keys: [""],
      label: "",
      retired: "2026-10-02",
    },
    {
      id: LIVE,
      keys: ["evidence-law/old-name", "evidence-law/proof-of-writings"],
      label: "Proof of writings",
    },
    {
      id: MERGED,
      keys: ["evidence-law/duplicate"],
      label: "Duplicate",
      replacedBy: LIVE,
      retired: "2026-10-02",
    },
    {
      id: GONE,
      keys: ["evidence-law/withdrawn-topic"],
      label: "Withdrawn",
      retired: "2026-10-02",
    },
  ],
  catalog = toCatalog(RECORDS);

describe("toCatalog", () => {
  test("drops an empty route and keeps the current key", () => {
    expect(catalog.concepts.map((concept) => concept.id)).toEqual([
      LIVE,
      MERGED,
      GONE,
    ]);
    expect(catalog.concepts[0]?.route).toBe("evidence-law/proof-of-writings");
  });

  test("a merged concept points at the survivor's current route", () => {
    const merged = catalog.concepts.find((concept) => concept.id === MERGED);
    expect(merged?.retired).toBe(true);
    expect(merged?.successor).toBe("evidence-law/proof-of-writings");
  });

  test("a cycle does not invent a successor", () => {
    const cycled = toCatalog([
      {
        id: "aa",
        keys: ["a"],
        label: "A",
        replacedBy: "bb",
        retired: "2026-01-01",
      },
      {
        id: "bb",
        keys: ["b"],
        label: "B",
        replacedBy: "aa",
        retired: "2026-01-01",
      },
    ]);
    expect(cycled.concepts.every((concept) => !concept.successor)).toBe(true);
  });
});

describe("search and list", () => {
  test("search matches the label and skips tombstones by default", () => {
    const hits = searchConcepts(catalog, "proof", 20, false);
    expect(hits.map((concept) => concept.id)).toEqual([LIVE]);
  });

  test("an empty query matches nothing", () => {
    expect(searchConcepts(catalog, "  ", 20, false)).toEqual([]);
  });

  test("list filters by area and paginates", () => {
    const page = listConcepts(catalog, {
      area: "evidence-law",
      includeRetired: false,
      limit: 1,
      page: 1,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]?.id).toBe(LIVE);
  });

  test("includeRetired brings tombstones back", () => {
    const page = listConcepts(catalog, {
      area: "",
      includeRetired: true,
      limit: 20,
      page: 1,
    });
    expect(page.total).toBe(3);
  });

  test("find prefers the id over the route", () => {
    expect(findConcept(catalog, { id: GONE, route: "" })?.label).toBe(
      "Withdrawn"
    );
    expect(
      findConcept(catalog, {
        id: "",
        route: "evidence-law/proof-of-writings",
      })?.id
    ).toBe(LIVE);
  });
});

describe("withBuiltPages", () => {
  test("drops a live concept whose page was not built", () => {
    const { catalog: built, dropped } = withBuiltPages(catalog, () => false);
    expect(dropped).toEqual(["evidence-law/proof-of-writings"]);
    expect(built.concepts.some((concept) => concept.id === LIVE)).toBe(false);
  });

  test("keeps tombstones: the identity resolver still answers for them", () => {
    const { catalog: built } = withBuiltPages(catalog, () => false);
    expect(built.concepts.map((concept) => concept.id)).toEqual([MERGED, GONE]);
  });

  test("a successor without a page is not offered as a link", () => {
    const { catalog: built } = withBuiltPages(catalog, () => false),
      merged = built.concepts.find((concept) => concept.id === MERGED);
    expect(merged?.successor).toBeUndefined();
  });

  test("a built page keeps the concept and its successor link", () => {
    const { catalog: built, dropped } = withBuiltPages(
        catalog,
        (route) => route === "evidence-law/proof-of-writings"
      ),
      merged = built.concepts.find((concept) => concept.id === MERGED);
    expect(dropped).toEqual([]);
    expect(built.concepts).toHaveLength(3);
    expect(merged?.successor).toBe("evidence-law/proof-of-writings");
  });
});
