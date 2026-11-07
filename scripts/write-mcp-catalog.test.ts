/**
 * The post-build step that writes dist/mcp-catalog.json for the /mcp Worker.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { allConcepts } from "../src/lib/concept-ids";
import type { Catalog } from "../src/lib/mcp-catalog";

const SCRIPT = path.join(import.meta.dirname, "write-mcp-catalog.ts"),
  dirs: string[] = [],
  live = allConcepts().find(
    (record) => !record.retired && Boolean(record.keys.at(-1))
  ),
  // oxlint-disable-next-line eslint/sort-vars -- liveId and liveRoute depend on live (TDZ)
  liveId = String(live?.id),
  liveRoute = String(live?.keys.at(-1));

async function fakeDist(routes: string[]): Promise<string> {
  const dist = await mkdtemp(path.join(tmpdir(), "mcp-catalog-"));
  dirs.push(dist);
  await writeFile(path.join(dist, "index.html"), "<html></html>");
  await Promise.all(
    routes.map(async (route) => {
      await mkdir(path.join(dist, route), { recursive: true });
      await writeFile(path.join(dist, route, "index.html"), "<html></html>");
    })
  );
  return dist;
}

async function run(dist: string) {
  const child = Bun.spawn(["bun", SCRIPT, dist], {
      stderr: "pipe",
      stdout: "pipe",
    }),
    [exitCode, stderr, stdout] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ]);
  return { exitCode, stderr, stdout };
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    })
  );
});

describe("write-mcp-catalog", () => {
  test("writes only the concepts whose page is in this dist", async () => {
    const dist = await fakeDist([liveRoute]),
      result = await run(dist),
      // oxlint-disable-next-line eslint/sort-vars -- catalog exists only after run (TDZ)
      catalog = JSON.parse(
        await readFile(path.join(dist, "mcp-catalog.json"), "utf8")
      ) as Catalog,
      // oxlint-disable-next-line eslint/sort-vars -- liveIds depends on catalog (TDZ)
      liveIds = catalog.concepts
        .filter((concept) => !concept.retired)
        .map((concept) => concept.id);
    expect(result.exitCode).toBe(0);
    expect(catalog.version).toBe(1);
    expect(liveIds).toEqual([liveId]);
    expect(result.stdout).toContain("1 live");
  });

  test("refuses to write an empty catalog", async () => {
    const dist = await fakeDist([]),
      // oxlint-disable-next-line eslint/sort-vars -- result depends on dist (TDZ)
      result = await run(dist);
    expect(result.exitCode).toBe(1);
    expect(await Bun.file(path.join(dist, "mcp-catalog.json")).exists()).toBe(
      false
    );
  });

  test("takes labels from the build's SKOS dump, not the registry", async () => {
    const dist = await fakeDist([liveRoute]);
    await writeFile(
      path.join(dist, "skos.jsonld"),
      JSON.stringify({
        "@graph": [
          {
            "@id": `https://w3id.org/digest-law/concept/${liveId}`,
            "skos:prefLabel": { "@language": "en", "@value": "Current Label" },
          },
        ],
      })
    );
    // oxlint-disable-next-line eslint/one-var -- runs after the dump is written
    const result = await run(dist),
      // oxlint-disable-next-line eslint/sort-vars -- catalog exists only after run (TDZ)
      catalog = JSON.parse(
        await readFile(path.join(dist, "mcp-catalog.json"), "utf8")
      ) as Catalog;
    expect(result.exitCode).toBe(0);
    expect(
      catalog.concepts.find((concept) => concept.id === liveId)?.label
    ).toBe("Current Label");
  });

  test("without a SKOS dump it keeps registry labels and says so", async () => {
    const dist = await fakeDist([liveRoute]),
      // oxlint-disable-next-line eslint/sort-vars -- result depends on dist (TDZ)
      result = await run(dist);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("skos.jsonld");
  });

  test("refuses a directory that is not a build", async () => {
    const result = await run(
      path.join(tmpdir(), "no-such-dist-for-mcp-catalog")
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("run the build first");
  });
});
