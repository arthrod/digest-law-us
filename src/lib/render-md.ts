/**
 * Build-time markdown rendering for source chunks, using Astro's own
 * markdown pipeline (@astrojs/markdown-remark). Source text never passes
 * through the content-layer store (see src/loaders/sources.ts) — each
 * source page renders exactly its own ≤200 KB slice here.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
<<<<<<< HEAD
import {
  createMarkdownProcessor,
  type MarkdownRenderer,
} from "@astrojs/markdown-remark";
=======
import { createMarkdownProcessor, type MarkdownRenderer } from "@astrojs/markdown-remark";
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
import { CORPUS_DIR } from "@/corpus.config";

let processorPromise: Promise<MarkdownRenderer> | null = null;

function getProcessor(): Promise<MarkdownRenderer> {
  // Sources are prose, not code — skip syntax highlighting for speed.
  processorPromise ??= createMarkdownProcessor({ syntaxHighlight: false });
  return processorPromise;
}

const corpusRoot = path.resolve(process.cwd(), CORPUS_DIR);

/** Tiny LRU for frontmatter-stripped source contents (12.5 MB max each). */
const contentCache = new Map<string, string>();
const CACHE_MAX = 8;

async function readSourceContent(relFile: string): Promise<string> {
  const hit = contentCache.get(relFile);
  if (hit !== undefined) {
    contentCache.delete(relFile);
    contentCache.set(relFile, hit);
    return hit;
  }
  const raw = await fs.readFile(path.join(corpusRoot, relFile), "utf-8");
  const { content } = matter(raw);
  contentCache.set(relFile, content);
  if (contentCache.size > CACHE_MAX) {
    const oldest = contentCache.keys().next().value;
    if (oldest !== undefined) contentCache.delete(oldest);
  }
  return content;
}

export interface RenderedChunk {
  html: string;
}

export async function renderSourceChunk(
  relFile: string,
<<<<<<< HEAD
  span: { start: number; end: number }
=======
  span: { start: number; end: number },
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
): Promise<RenderedChunk> {
  const content = await readSourceContent(relFile);
  const slice = content.slice(span.start, span.end);
  const processor = await getProcessor();
  const result = await processor.render(slice);
  return { html: result.code };
}
