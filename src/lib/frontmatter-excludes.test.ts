import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { glob } from "tinyglobby";

import {
  FRONTMATTER_EXCLUDES_FILE,
  readFrontmatterExcludes,
} from "./frontmatter-excludes";

let dir = "",
  home = "";

beforeEach(async () => {
  home = process.cwd();
  dir = await mkdtemp(path.join(tmpdir(), "fm-excludes-"));
  process.chdir(dir);
});

afterEach(async () => {
  process.chdir(home);
  await rm(dir, { force: true, recursive: true });
});

describe("readFrontmatterExcludes", () => {
  test("a missing list excludes nothing", async () => {
    expect(await readFrontmatterExcludes()).toEqual([]);
  });

  test("listed files drop out of the digests glob, special characters included", async () => {
    const corpus = path.join(dir, "corpus");
    for (const rel of ["a/ok.md", "a/bad (1).md", "b/[x].md", "b/keep.md"]) {
      await Bun.write(path.join(corpus, rel), "");
    }
    await writeFile(
      FRONTMATTER_EXCLUDES_FILE,
      JSON.stringify(["a/bad (1).md", "b/[x].md"])
    );
    // oxlint-disable-next-line eslint/one-var -- must glob after the fixtures and the list are written
    const kept = await glob(["**/*.md", ...(await readFrontmatterExcludes())], {
      cwd: corpus,
    });
    expect(kept.toSorted()).toEqual(["a/ok.md", "b/keep.md"]);
  });

  test("a list that is not an array is an error, not a silent no-op", async () => {
    await writeFile(FRONTMATTER_EXCLUDES_FILE, '{"a": 1}');
    await expect(readFrontmatterExcludes()).rejects.toThrow(TypeError);
  });
});
