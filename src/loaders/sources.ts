/**
 * Metadata loader for retained source documents.
 *
 * Sources total ~372 MB of markdown (single files up to 12.5 MB), so their
 * text deliberately never enters the content-layer data store — only
 * metadata and chunk offsets do. Source pages read + render their own slice
 * at build time (see src/lib/render-md.ts), which keeps the store small and
 * makes hard constraint 3 (≤200 KB of source markdown per page) structural.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import type { Loader } from "astro/loaders";
import { slugSegment } from "@/lib/labels";
import { SOURCE_CHUNK_BYTES } from "@/corpus.config";

export interface ChunkSpan {
  /** JS string index into the frontmatter-stripped content */
  start: number;
  end: number;
}

/**
 * Split markdown into parts of roughly `target` characters, preferring
 * blank-line boundaries and never splitting inside a code fence unless the
 * fence itself is grossly oversized. Returns string spans, not copies.
 */
export function splitSpans(content: string, target: number): ChunkSpan[] {
  if (content.length <= target * 1.35) {
    return [{ start: 0, end: content.length }];
  }
  const spans: ChunkSpan[] = [];
  let start = 0;
  let size = 0;
  let inFence = false;
  let cursor = 0;
  while (cursor < content.length) {
    let nl = content.indexOf("\n", cursor);
    if (nl === -1) nl = content.length;
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
      spans.push({ start, end: nl + 1 > content.length ? content.length : nl + 1 });
      start = nl + 1;
      size = 0;
      inFence = false;
    }
    cursor = nl + 1;
  }
  if (start < content.length) {
    spans.push({ start, end: content.length });
  }
  return spans;
}

export function sourcesLoader(corpusDir: string): Loader {
  return {
    name: "ald-sources",
    async load({ store, logger, config, parseData, generateDigest }) {
      const root = path.resolve(fileURLToPath(config.root), corpusDir);
      const listing = (await fs.readdir(root, {
        recursive: true,
      })) as string[];
<<<<<<< HEAD
      const files = listing
        .filter(rel => /(^|\/)sources\/[^/]+\.md$/.test(rel))
        .sort();
=======
      const files = listing.filter((rel) => /(^|\/)sources\/[^/]+\.md$/.test(rel)).sort();
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

      store.clear();
      const usedSlugs = new Map<string, Set<string>>();
      let count = 0;

      for (const rel of files) {
        const raw = await fs.readFile(path.join(root, rel), "utf-8");
        let fm: Record<string, unknown>;
        let content: string;
        try {
          ({ data: fm, content } = matter(raw));
        } catch (err) {
          // A malformed frontmatter block must not kill a multi-hour build:
          // keep the document (body = whole file), log loudly, never drop.
          logger.warn(`Broken frontmatter in ${rel}: ${err}`);
          fm = {};
          content = raw;
        }
        const bundle = rel.slice(0, rel.lastIndexOf("/sources/"));
        const fileName = path.basename(rel, ".md");

        let slug = slugSegment(fileName) || "source";
        const taken = usedSlugs.get(bundle) ?? new Set<string>();
        if (taken.has(slug)) {
          let n = 2;
          while (taken.has(`${slug}-${n}`)) n++;
          slug = `${slug}-${n}`;
        }
        taken.add(slug);
        usedSlugs.set(bundle, taken);

        const spans = splitSpans(content, SOURCE_CHUNK_BYTES);
        const id = `${bundle}/sources/${slug}`;
        const data = await parseData({
          id,
          data: {
            bundle,
            slug,
            relFile: rel,
            title: typeof fm.title === "string" ? fm.title : fileName,
<<<<<<< HEAD
            description:
              typeof fm.description === "string" ? fm.description : "",
=======
            description: typeof fm.description === "string" ? fm.description : "",
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
            resource: typeof fm.resource === "string" ? fm.resource : "",
            tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
            retained: fm.timestamp ? String(fm.timestamp) : "",
            bytes: Buffer.byteLength(content),
            chars: content.length,
            parts: spans.length,
            spans,
          },
        });
        store.set({ id, data, digest: generateDigest(data) });
        count++;
      }
      logger.info(`Indexed ${count} retained sources (metadata only)`);
    },
  };
}
