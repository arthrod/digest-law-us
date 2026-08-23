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

/**
 * gray-matter's delimiters, mirrored from its `index.js`: the block opens
 * with `---` at position 0 (unless the next character is another `-`) and
 * closes at the first `\n---`, and one `\r?\n` after the closing delimiter
 * belongs to the delimiter, not the body.
 */
const CLOSE = "\n---",
  /** Values that open a flow collection, a block scalar, or an alias are not
   *  scalars this can recover; they are exactly what tends to be malformed. */
  NOT_SCALAR = /^[[{|>&*!]/u,
  OPEN = "---",
  /** A top-level `key: value` line — column 0, value on the same line. */
  SCALAR_LINE = /^(?<key>[A-Za-z_][\w-]*):[ \t]+(?<value>\S.*)$/u;

interface Delimited {
  /** The frontmatter text, delimiters excluded. */
  block: string;
  /** The document body, sliced exactly where gray-matter would slice it. */
  body: string;
}

/** Split a file at its frontmatter delimiters without parsing the YAML.
 *  Null when there is no frontmatter block at all. */
function splitAtDelimiters(raw: string): Delimited | null {
  if (!raw.startsWith(OPEN) || raw.charAt(OPEN.length) === "-") {
    return null;
  }
  const close = raw.indexOf(CLOSE, OPEN.length);
  if (close === -1) {
    // Unterminated block: gray-matter treats the whole file as frontmatter.
    return { block: raw.slice(OPEN.length), body: "" };
  }
  return {
    block: raw.slice(OPEN.length, close),
    body: raw.slice(close + CLOSE.length).replace(/^\r?\n?/u, ""),
  };
}

/** Strip one layer of matched surrounding quotes; otherwise take the text
 *  verbatim. No escape processing — the input is by definition not YAML. */
function unquote(value: string): string {
  const clean = value.trimEnd(),
    quote = clean.charAt(0);
  if (
    (quote === '"' || quote === "'") &&
    clean.length > 1 &&
    clean.endsWith(quote)
  ) {
    return clean.slice(1, -1);
  }
  return clean;
}

/**
 * Best-effort metadata recovery from a frontmatter block that will not parse.
 *
 * Every malformed block seen in the corpus is malformed on *one* line — an
 * unescaped quote inside a `tags:` flow sequence, or prose trailing a quoted
 * `description:` — while the rest are ordinary `key: "value"` scalars. YAML
 * is all-or-nothing, so one bad line costs the whole record; a line scan
 * costs only the bad line.
 *
 * Deliberately narrow: column-0 scalars only, first occurrence wins (a real
 * field always precedes any line a multi-line value might fake), and flow
 * collections and block scalars are skipped rather than guessed at. So a
 * broken `tags:` stays lost while `title`, `description`, `resource` and
 * `timestamp` — the fields that carry a source page's provenance — survive.
 */
function salvageScalars(block: string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const found = SCALAR_LINE.exec(line)?.groups;
    if (!found?.key || NOT_SCALAR.test(found.value ?? "")) {
      continue;
    }
    data[found.key] ??= unquote(found.value ?? "");
  }
  return data;
}

export interface LooseFrontmatter {
  content: string;
  data: Record<string, unknown>;
  /** Set when the YAML failed to load; `data` then holds whatever a line
   *  scan could salvage and `content` the delimiter-sliced body. */
  error?: unknown;
}

/**
 * Parse frontmatter, surviving YAML the corpus generator wrote badly.
 *
 * The corpus is machine-produced and a handful of documents carry frontmatter
 * that is not loadable YAML — e.g. a `tags:` flow sequence holding a raw
 * search query whose own double quotes were never escaped:
 *
 *     tags: [""17 CFR 240.14a-16" notice and access site:law.cornell.edu"]
 *
 * A single such file must not kill a multi-hour, ~57k-page build, so the
 * failure is contained here: the body is recovered by slicing at the
 * delimiters, the metadata by `salvageScalars`, and the caller decides how
 * loudly to complain. Losing the build to one file is unacceptable; so is
 * silently dropping a source page's `resource:` link, which is the one thing
 * on the page that makes it provenance rather than a quotation.
 *
 * Every reader of a corpus file goes through this, and that is the point —
 * the loaders record chunk spans and a content hash for the body, and the
 * page renderer slices that same body at build time. If the two disagreed
 * about what a broken file's body is, the spans would index the wrong text.
 */
export function parseFrontmatterLoose(raw: string): LooseFrontmatter {
  try {
    const { content, data } = parseFrontmatter(raw);
    return { content, data };
  } catch (error) {
    const split = splitAtDelimiters(raw);
    if (!split) {
      return { content: raw, data: {}, error };
    }
    return { content: split.body, data: salvageScalars(split.block), error };
  }
}
