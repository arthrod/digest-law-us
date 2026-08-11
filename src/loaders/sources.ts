/**
 * Metadata loader for retained source documents.
 *
 * Sources total ~5.6 GB of markdown (single files up to 12.5 MB), so their
 * text deliberately never enters the content-layer data store — only
 * metadata and chunk offsets do. Source pages read + render their own slice
 * at build time (see src/lib/render-md.ts), which keeps the store small and
 * makes hard constraint 3 (≤200 KB of source markdown per page) structural.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Loader } from "astro/loaders";
import matter from "gray-matter";

import { PREVIEW_MODE, SOURCE_CHUNK_BYTES } from "@/corpus.config";
import { slugSegment } from "@/lib/labels";
import { previewBundles } from "@/lib/preview";

export interface ChunkSpan {
  end: number;
  /** JS string index into the frontmatter-stripped content */
  start: number;
}

/**
 * Split markdown into parts of roughly `target` characters, preferring
 * blank-line boundaries and never splitting inside a code fence unless the
 * fence itself is grossly oversized. Returns string spans, not copies.
 */
export function splitSpans(content: string, target: number): ChunkSpan[] {
  if (content.length <= target * 1.35) {
    return [{ end: content.length, start: 0 }];
  }
  const spans: ChunkSpan[] = [];
  let start = 0;
  let size = 0;
  let inFence = false;
  let cursor = 0;
  while (cursor < content.length) {
    let nl = content.indexOf("\n", cursor);
    if (nl === -1) {
      nl = content.length;
    }
    const line = content.slice(cursor, nl);
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
    }
    size += nl - cursor + 1;
    const atBlank = trimmed === "";
    const flush =
      (!inFence && size >= target && atBlank) ||
      (!inFence && size >= target * 1.5) ||
      size >= target * 3;
    if (flush) {
      spans.push({
        end: nl + 1 > content.length ? content.length : nl + 1,
        start,
      });
      start = nl + 1;
      size = 0;
      inFence = false;
    }
    cursor = nl + 1;
  }
  if (start < content.length) {
    spans.push({ end: content.length, start });
  }
  return spans;
}

export function sourcesLoader(corpusDir: string): Loader {
  return {
    async load({ store, logger, config, parseData, generateDigest }) {
      const root = path.resolve(fileURLToPath(config.root), corpusDir);
      const listing = await fs.readdir(root, {
        recursive: true,
      });
      // In preview mode the bundle set is decided before any file is read;
      // skipping here is what keeps a preview build from paying for the
      // whole ~372 MB of retained sources (see src/lib/preview.ts).
      const preview = PREVIEW_MODE ? await previewBundles(root) : null;
      const files = listing
        .filter((rel) => /(?:^|\/)sources\/[^/]+\.md$/u.test(rel))
        .filter(
          (rel) =>
            preview === null ||
            preview.has(rel.slice(0, rel.lastIndexOf("/sources/")))
        )
        .toSorted();

      store.clear();
      const usedSlugs = new Map<string, Set<string>>();
      let count = 0;

      for (const rel of files) {
        const raw = await fs.readFile(path.join(root, rel), "utf8");
        let fm: Record<string, unknown>;
        let content: string;
        try {
          ({ data: fm, content } = matter(raw));
        } catch (error) {
          // A malformed frontmatter block must not kill a multi-hour build:
          // keep the document (body = whole file), log loudly, never drop.
          logger.warn(`Broken frontmatter in ${rel}: ${error}`);
          fm = {};
          content = raw;
        }
        const bundle = rel.slice(0, rel.lastIndexOf("/sources/"));
        const fileName = path.basename(rel, ".md");

        let slug = slugSegment(fileName) || "source";
        const taken = usedSlugs.get(bundle) ?? new Set<string>();
        if (taken.has(slug)) {
          let n = 2;
          while (taken.has(`${slug}-${n}`)) {
            n += 1;
          }
          slug = `${slug}-${n}`;
        }
        taken.add(slug);
        usedSlugs.set(bundle, taken);

        const spans = splitSpans(content, SOURCE_CHUNK_BYTES);
        const id = `${bundle}/sources/${slug}`;
        const data = await parseData({
          data: {
            bundle,
            bytes: Buffer.byteLength(content),
            chars: content.length,
            /**
             * The retained text never enters the store, so without this the
             * entry digest only sees metadata — and an edit that preserves
             * length and chunk boundaries would leave `spans`/`bytes`
             * unchanged, letting an incremental build skip a source page
             * whose on-disk text differs (see cacheKey in
             * src/pages/[...path].astro). The file is already in memory
             * here; hashing it closes that hole.
             */
            contentSha: createHash("sha256").update(content).digest("hex"),
            description:
              typeof fm.description === "string" ? fm.description : "",
            parts: spans.length,
            relFile: rel,
            resource: typeof fm.resource === "string" ? fm.resource : "",
            retained: fm.timestamp ? String(fm.timestamp) : "",
            slug,
            spans,
            tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
            title: typeof fm.title === "string" ? fm.title : fileName,
          },
          id,
        });
        store.set({ data, digest: generateDigest(data), id });
        count += 1;
      }
      logger.info(`Indexed ${count} retained sources (metadata only)`);
    },
    name: "ald-sources",
  };
}
