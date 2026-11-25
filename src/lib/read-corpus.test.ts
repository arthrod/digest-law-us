import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { readCorpusFile } from "./read-corpus";

describe("readCorpusFile", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "read-corpus-"));

  test("returns the contents of an existing file", async () => {
    const file = path.join(dir, "a.md");
    await writeFile(file, "hello");
    expect(await readCorpusFile(file)).toBe("hello");
  });

  test("returns null for a file deleted after listing", async () => {
    expect(await readCorpusFile(path.join(dir, "gone.md"))).toBeNull();
  });

  test("returns null when a parent folder was deleted", async () => {
    expect(
      await readCorpusFile(path.join(dir, "no-bundle", "sources", "x.md"))
    ).toBeNull();
  });

  test("still throws on other errors", async () => {
    const sub = path.join(dir, "is-a-dir");
    await mkdir(sub);
    await expect(readCorpusFile(sub)).rejects.toThrow();
  });
});
