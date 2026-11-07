/**
 * The post-build head check, run end to end on small fake dists.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CRUMBS,
  DIGEST_HEAD,
  html,
  HOME_HEAD,
  ld,
  PAGE_HEAD,
} from "../src/lib/head-check.fixtures";

const DIGEST = html(DIGEST_HEAD, [ld(CRUMBS)]),
  HOME = html(HOME_HEAD),
  PAGE = html(PAGE_HEAD),
  SCRIPT = path.join(import.meta.dirname, "check-head.ts"),
  dirs: string[] = [];

async function fakeDist(pages: Record<string, string>): Promise<string> {
  const dist = await mkdtemp(path.join(tmpdir(), "check-head-"));
  dirs.push(dist);
  await Promise.all(
    Object.entries(pages).map(async ([route, page]) => {
      await mkdir(path.join(dist, route), { recursive: true });
      await writeFile(path.join(dist, route, "index.html"), page);
    })
  );
  return dist;
}

async function run(...args: string[]) {
  const child = Bun.spawn(["bun", SCRIPT, ...args], {
      stderr: "pipe",
      stdout: "pipe",
    }),
    [exitCode, stdout] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
    ]);
  return { exitCode, stdout };
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    })
  );
});

describe("scripts/check-head.ts", () => {
  test("a dist whose pages all pass exits 0", async () => {
    const dist = await fakeDist({
        "": HOME,
        about: PAGE,
        "evidence-law/proof-of-writings": DIGEST,
      }),
      { exitCode, stdout } = await run(dist, "--all");
    expect(stdout).toContain("3 pages checked: 1 home, 1 digest, 1 other");
    expect(stdout).toContain("no problems");
    expect(exitCode).toBe(0);
  });

  test("a failing page is counted, named, and fails the run", async () => {
    const broken = html(PAGE_HEAD.filter((tag) => !tag.includes("og:locale"))),
      dist = await fakeDist({ "": HOME, about: broken }),
      { exitCode, stdout } = await run(dist, "--all");
    expect(stdout).toMatch(/og:locale\s+1/u);
    expect(stdout).toContain("/about/");
    expect(exitCode).toBe(1);
  });

  test("digest pages that share a description fail the run", async () => {
    const dist = await fakeDist({
        "": HOME,
        "a/one": DIGEST,
        "a/two": DIGEST,
      }),
      { exitCode, stdout } = await run(dist, "--all");
    expect(stdout).toContain("shared descriptions: 1");
    expect(stdout).toContain("on 2 pages: /a/one/, /a/two/");
    expect(exitCode).toBe(1);
  });

  test("--sample=N checks N pages, the home page among them", async () => {
    const dist = await fakeDist({ "": HOME, a: PAGE, b: PAGE, c: PAGE }),
      { stdout } = await run(dist, "--sample=2");
    expect(stdout).toContain("2 pages checked: 1 home, 0 digest, 1 other");
  });

  test.each([
    "--sample=abc",
    "--sample=",
    "--sample=0",
    "--sample=-5",
    "--sample=2.5",
  ])("%s is refused, not a pass on the home page alone", async (flag) => {
    const dist = await fakeDist({ "": HOME, a: PAGE }),
      { exitCode, stdout } = await run(dist, flag);
    expect(stdout).toContain("--sample must be a positive integer");
    expect(stdout).not.toContain("pages checked");
    expect(exitCode).toBe(1);
  });

  test("no built pages is an error, not a pass", async () => {
    const dist = await fakeDist({}),
      { exitCode, stdout } = await run(dist);
    expect(stdout).toContain("no index.html");
    expect(exitCode).toBe(1);
  });
});
