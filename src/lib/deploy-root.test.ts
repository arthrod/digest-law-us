/**
 * What the root Worker must serve itself, whatever the shard packer decides.
 */
import { describe, expect, test } from "bun:test";

import {
  missingRootFiles,
  REQUIRED_ROOT_FILES,
  staysOnRoot,
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
