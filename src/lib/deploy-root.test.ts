/**
 * What the root Worker must serve itself, whatever the shard packer decides.
 */
import { describe, expect, test } from "bun:test";

import {
  missingRootFiles,
  REQUIRED_ROOT_FILES,
  splitWorkerReads,
  staleCopies,
  staysOnRoot,
  WORKER_READ_FILES,
} from "./deploy-root";

// Written by the build itself: id-map.json by an Astro endpoint,
// mcp-catalog.json by scripts/write-mcp-catalog.ts.
const GENERATED = new Set(["id-map.json", "mcp-catalog.json"]),
  STATIC_FILES = REQUIRED_ROOT_FILES.filter((file) => !GENERATED.has(file));

describe("staysOnRoot", () => {
  test("dot-folders stay on root: /.well-known must answer without a shard", () => {
    expect(staysOnRoot(".well-known")).toBe(true);
  });

  test("ordinary folders are left to the packer", () => {
    expect(staysOnRoot("evidence-law")).toBe(false);
    expect(staysOnRoot("_astro")).toBe(false);
    expect(staysOnRoot("pagefind")).toBe(false);
  });
});

describe("missingRootFiles", () => {
  test("names every required file that is absent", async () => {
    expect(await missingRootFiles(() => false)).toEqual([
      ...REQUIRED_ROOT_FILES,
    ]);
  });

  test("is empty when every required file is present", async () => {
    expect(await missingRootFiles(() => Promise.resolve(true))).toEqual([]);
  });

  test("the MCP Worker's inputs are required: catalog and server card", () => {
    expect(REQUIRED_ROOT_FILES).toContain("mcp-catalog.json");
    expect(REQUIRED_ROOT_FILES).toContain(".well-known/mcp/server-card.json");
  });

  test.each(STATIC_FILES)("%s is committed under public/", async (file) => {
    expect(await Bun.file(`public/${file}`).exists()).toBe(true);
  });
});

describe("splitWorkerReads", () => {
  test("the Worker reads the id map and the MCP catalog whole", () => {
    expect([...WORKER_READ_FILES].toSorted()).toEqual([
      "id-map.json",
      "mcp-catalog.json",
    ]);
  });

  test("every Worker-read map is also required on root", () => {
    expect(REQUIRED_ROOT_FILES).toEqual(
      expect.arrayContaining([...WORKER_READ_FILES])
    );
  });

  test("a split SKOS dump is fine: browsers get it through the oversize route", () => {
    expect(splitWorkerReads(["/skos.jsonld"])).toEqual([]);
  });

  test("a split catalog or id map is named", () => {
    expect(
      splitWorkerReads(["/mcp-catalog.json", "/skos.jsonld", "/id-map.json"])
    ).toEqual(["id-map.json", "mcp-catalog.json"]);
  });
});

describe("staleCopies", () => {
  test("names public files whose dist copy differs or is missing", async () => {
    const differs = new Set([".well-known/api-catalog", "_headers"]);
    expect(
      await staleCopies(
        ["_headers", "favicon.svg", ".well-known/api-catalog"],
        (file) => !differs.has(file)
      )
    ).toEqual(["_headers", ".well-known/api-catalog"]);
  });

  test("is empty when dist matches public", async () => {
    expect(
      await staleCopies(["_headers", "favicon.svg"], () =>
        Promise.resolve(true)
      )
    ).toEqual([]);
  });

  test("pagefind is not compared: it is copied from dist into public", async () => {
    const asked: string[] = [];
    await staleCopies(["pagefind/pagefind.js", "_headers"], (file) => {
      asked.push(file);
      return true;
    });
    expect(asked).toEqual(["_headers"]);
  });
});
