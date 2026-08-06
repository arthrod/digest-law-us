/**
 * Build-time markdown rendering for source chunks, using Astro's own
 * markdown pipeline (@astrojs/markdown-remark). Source text never passes
 * through the content-layer store (see src/loaders/sources.ts) — each
 * source page renders exactly its own ≤200 KB slice here.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import type { MarkdownRenderer } from "@astrojs/markdown-remark";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import matter from "gray-matter";

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
  const raw = await fs.readFile(path.join(corpusRoot, relFile), "utf8");
  const { content } = matter(raw);
  contentCache.set(relFile, content);
  if (contentCache.size > CACHE_MAX) {
    const oldest = contentCache.keys().next().value;
    if (oldest !== undefined) {
      contentCache.delete(oldest);
    }
  }
  return content;
}

export interface RenderedChunk {
  html: string;
}

/**
 * Render a whole corpus markdown file that is held out of the content store
 * (see src/loaders/audits.ts). Frontmatter is stripped before rendering, the
 * same way the content layer would have done it.
 *
 * Deliberately not cached: each file is rendered once, for its own page, and
 * holding them would reintroduce exactly the memory pressure that keeping
 * them out of the store is meant to avoid.
 */
export async function renderCorpusFile(relFile: string): Promise<string> {
  const raw = await fs.readFile(path.join(corpusRoot, relFile), "utf8");
  const { content } = matter(raw);
  const processor = await getProcessor();
  const result = await processor.render(content);
  return result.code;
}

export async function renderSourceChunk(
  relFile: string,
  span: { start: number; end: number }
): Promise<RenderedChunk> {
  const content = await readSourceContent(relFile);
  const slice = content.slice(span.start, span.end);
  const processor = await getProcessor();
  const result = await processor.render(slice);
  return { html: result.code };
}
