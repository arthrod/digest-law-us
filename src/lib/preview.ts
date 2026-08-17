/**
 * Preview-build bundle selection — computed once, from one directory
 * listing, before anything reads a file.
 *
 * Incremental builds (astro.config.ts) skip re-rendering unchanged pages,
 * but only when the code is untouched — any edit to a shared component
 * re-renders every route, and the content layer re-reads every corpus file
 * regardless. Preview mode cuts the corpus to a handful of bundles instead
 * — but the cut only pays off if it happens *before* the loaders read
 * ~5.6 GB of retained sources. That is what this module is for:
 * `content.config.ts` narrows its globs to these directories, the sources
 * loader skips everything else, and `corpus.ts` filters against the same
 * set, so all three agree by construction.
 *
 * Selection is deterministic and needs no file contents: bundles are scored
 * by how many views they exercise (audit, caselaw index, statutory index,
 * retained sources) and taken round-robin across top-level areas, so ten
 * bundles still cover every page type and more than one area.
 *
 * Configured by PREVIEW_BUNDLES / PREVIEW_PATHS — see src/corpus.config.ts.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { PREVIEW_BUNDLES, PREVIEW_MODE, PREVIEW_PATHS } from "@/corpus.config";

import { slugSegment } from "./labels";

/** Digest bundles hold `<dir>/<dir-basename>.md`; that is what marks one. */
const SOURCE_FILE = /(?:^|\/)sources\/[^/]+\.md$/u;

function matchesPreviewPath(dir: string): boolean {
  const slug = dir.split("/").map(slugSegment).join("/");
  return PREVIEW_PATHS.some(
    (p) =>
      dir === p ||
      dir.startsWith(`${p}/`) ||
      slug === p ||
      slug.startsWith(`${p}/`)
  );
}

/** Round-robin across areas so a small sample is never one giant area. */
function roundRobin(
  dirs: string[],
  score: (dir: string) => number,
  limit: number
): string[] {
  const byArea = new Map<string, string[]>();
  for (const dir of dirs) {
    const [area] = dir.split("/"),
     list = byArea.get(area) ?? [];
    list.push(dir);
    byArea.set(area, list);
  }
  for (const list of byArea.values()) {
    list.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  }
  const areas = [...byArea.keys()].toSorted(),
   kept: string[] = [];
  for (let round = 0; kept.length < limit; round += 1) {
    let advanced = false;
    for (const area of areas) {
      const candidate = byArea.get(area)?.[round];
      if (candidate === undefined) {
        continue;
      }
      advanced = true;
      kept.push(candidate);
      if (kept.length >= limit) {
        break;
      }
    }
    if (!advanced) {
      break;
    }
  }
  return kept;
}

async function select(corpusDir: string): Promise<Set<string>> {
  const listing = await fs.readdir(corpusDir, { recursive: true }),
   files = new Set(listing.map((p) => p.replaceAll("\\", "/"))),

   sourcesPerBundle = new Map<string, number>(),
   bundles: string[] = [];
  for (const rel of files) {
    if (SOURCE_FILE.test(rel)) {
      const bundle = rel.slice(0, rel.lastIndexOf("/sources/"));
      sourcesPerBundle.set(bundle, (sourcesPerBundle.get(bundle) ?? 0) + 1);
      continue;
    }
    if (!rel.endsWith(".md")) {
      continue;
    }
    const dir = rel.slice(0, rel.lastIndexOf("/")),
     base = rel.slice(dir.length + 1, -".md".length);
    if (dir && base === dir.split("/").at(-1)) {
      bundles.push(dir);
    }
  }
  bundles.sort();

  if (PREVIEW_PATHS.length > 0) {
    const picked = bundles.filter(matchesPreviewPath);
    return new Set(
      PREVIEW_BUNDLES > 0 ? picked.slice(0, PREVIEW_BUNDLES) : picked
    );
  }

  const score = (dir: string) =>
    (files.has(`${dir}/_source_snippet_audit.md`) ? 1 : 0) +
    (files.has(`${dir}/caselaw_index.md`) ? 1 : 0) +
    (files.has(`${dir}/statutory_index.md`) ? 1 : 0) +
    Math.min(sourcesPerBundle.get(dir) ?? 0, 3);

  return new Set(roundRobin(bundles, score, PREVIEW_BUNDLES));
}

/** Keyed by resolved path: callers reach the corpus by both a relative
 *  config value and an absolute loader root, and both must hit one listing. */
const cache = new Map<string, Promise<Set<string>>>();

/**
 * The bundle directories a preview build is limited to, relative to the
 * corpus root. Empty when preview mode is off — callers must treat an empty
 * set as "no filtering", never as "nothing to build".
 */
export function previewBundles(corpusDir: string): Promise<Set<string>> {
  if (!PREVIEW_MODE) {
    return Promise.resolve(new Set<string>());
  }
  const key = path.resolve(corpusDir);
  let pending = cache.get(key);
  if (!pending) {
    pending = select(key);
    cache.set(key, pending);
  }
  return pending;
}
