/**
 * Frontmatter parsing — gray-matter with its global cache disabled.
 *
 * Called with no options argument, `matter(raw)` stores every parsed file in
 * a module-level cache keyed by the file's own text
 * (`matter.cache[file.content] = file`), and nothing ever evicts it. Each
 * entry pins that text roughly three times over — once as the key, once as
 * `file.content`, and once as `file.orig`, a Buffer copy — for the lifetime
 * of the process.
 *
 * At corpus scale that is fatal, and it is invisible. The retained sources
 * alone are ~13 GB of markdown across 80,310 files, and measurement puts the
 * retained heap at ~3x the text it parses (4,000 sources / 647 MB of text:
 * 278 MB RSS with the cache off, 2,201 MB with it on). So a build that reads
 * them all through `matter(raw)` needs ~39 GB of heap for text nothing will
 * look at again — it exhausts a 24 GB old space around 60% of the way
 * through the sources and dies with a bare "Ineffective mark-compacts near
 * heap limit" that names no cause. Worse, the cache quietly undoes every
 * place this codebase bounds memory on purpose: the
 * metadata-only loaders that keep source and audit bodies out of the content
 * store, the 8-entry LRU in `render-md.ts`, the "deliberately not cached"
 * contract on `renderCorpusFile`. All of them dropped their copy; gray-matter
 * kept one.
 *
 * Passing any options object opts out of the cache, and `{}` is exactly what
 * gray-matter builds from no arguments anyway (`Object.assign({}, options)`
 * in its lib/defaults.js), so parsing behaviour is unchanged.
 *
 * Every gray-matter call in this project goes through here. Importing
 * `gray-matter` directly reintroduces the leak.
 */
import matter from "gray-matter";

/** Parse `raw`'s frontmatter without populating gray-matter's global cache. */
export function parseFrontmatter(raw: string) {
  return matter(raw, {});
}
