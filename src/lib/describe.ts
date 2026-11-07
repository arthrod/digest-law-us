/**
 * What a digest says about itself away from its own page: its RSS item, and
 * the meta description, og:description and Article description of its page.
 * In order: its own frontmatter description, its SKOS definition, its
 * opening paragraph, a generic sentence.
 *
 * A description the research run wrote for many digests at once describes
 * none of them: "Derived from retained sources of the research run…" or a
 * "Provisional synthesis — …" caveat (shown on the page itself) heads
 * 13,243 of 15,524 digests. They are recognized by their text, from the
 * one digest alone: a count over the corpus would be an input the
 * incremental build's cache key cannot see (cache-keys.ts), and a page could
 * keep a stale description. scripts/check-head.ts reports descriptions that
 * sampled pages share, which is how a new one would be found.
 *
 * Pure, with no astro imports, so `bun test` covers it. DigestView imports
 * it, so a change here re-renders every digest page (rebuild tier 2).
 */

/**
 * Openings of descriptions the research run wrote for many digests: its
 * sentence, with or without a period or a remediation note ("…research run
 * (PR #7227 remediation).", "…of this run (remediated)."), and the caveat,
 * always with its dash. "Provisional synthesis of…", "…for…" and "…from…"
 * open 91 descriptions of their own topic, so the dash is required.
 */
export const BOILERPLATE: readonly string[] = [
    "Derived from retained sources of",
    "Provisional synthesis —",
  ],
  /** A meta description over this is cut short in search results. */
  META_MAX = 160;

// oxlint-disable-next-line eslint/one-var -- an exported const cannot join this private list
const ANY_TAG =
    /<(?<close>\/)?(?<name>[a-z][\da-z-]*)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/giu,
  /** Paragraphs in these are quoted or set aside: never the digest's lede. */
  ASIDE_TAGS = new Set(["aside", "blockquote", "details", "figure"]),
  ENTITY =
    /&(?:#(?<dec>\d+)|#x(?<hex>[\da-f]+)|(?<name>amp|apos|gt|lt|nbsp|quot));/giu,
  /** A lede longer than this is cut at a word and ends with an ellipsis. */
  LEDE_MAX = 280,
  /** U+10FFFF, the last code point. */
  MAX_CODE_POINT = 1_114_111,
  NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  },
  /** A tag, quoted attribute values and all: a > inside quotes is not its end. */
  TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/gu,
  /** The code point ranges XML 1.0 can carry (its `Char` production). */
  XML_CHARS: readonly (readonly [number, number])[] = [
    // U+0009–U+000A, U+000D, U+0020–U+D7FF, U+E000–U+FFFD, U+10000–U+10FFFF
    [9, 10],
    [13, 13],
    [32, 55_295],
    [57_344, 65_533],
    [65_536, MAX_CODE_POINT],
  ];

/** Empty, or written for many digests at once (BOILERPLATE). */
export function isBoilerplate(description: string): boolean {
  const text = description.trim();
  return !text || BOILERPLATE.some((opening) => text.startsWith(opening));
}

/** What describeDigest reads. */
export interface Describable {
  /** Label of the digest's area (the first breadcrumb). */
  area: string;
  definition: string;
  description: string;
  label: string;
  /** The digest's opening paragraph, as plain text (ledeOf). */
  lede?: string;
}

/**
 * What the digest says about itself: the frontmatter description unless it
 * is boilerplate, then the SKOS definition, then the opening paragraph, then
 * the generic sentence.
 */
export function describeDigest(digest: Describable): string {
  return (
    (isBoilerplate(digest.description) ? "" : digest.description) ||
    digest.definition ||
    digest.lede ||
    `Digest of ${digest.label} in ${digest.area}, with retained sources and audit.`
  );
}

/**
 * A numeric reference stays as written unless it names a character XML can
 * carry: past U+10FFFF it names none, and NUL, most C0 controls, lone
 * surrogates and U+FFFE/U+FFFF would make the feed ill-formed.
 */
function fromCodePoint(code: number, match: string): string {
  return XML_CHARS.some(([low, high]) => code >= low && code <= high)
    ? String.fromCodePoint(code)
    : match;
}

function decodeEntities(text: string): string {
  return text.replaceAll(ENTITY, (match, ...args: unknown[]) => {
    const groups = args.at(-1) as { dec?: string; hex?: string; name?: string };
    if (groups.dec) {
      return fromCodePoint(Number(groups.dec), match);
    }
    if (groups.hex) {
      return fromCodePoint(Number.parseInt(groups.hex, 16), match);
    }
    return NAMED_ENTITIES[groups.name?.toLowerCase() ?? ""] ?? match;
  });
}

/** Text over `max` is cut at the last whole word and given an ellipsis,
 *  never between the two halves of a surrogate pair. */
function clip(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/u, ""),
    space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The paragraphs outside ASIDE_TAGS, in document order.
 * @yields {string} The inner HTML of each such paragraph.
 */
function* paragraphs(html: string): Generator<string> {
  let aside = 0,
    start = -1;
  for (const tag of html.matchAll(ANY_TAG)) {
    const { close, name = "" } = tag.groups ?? {},
      element = name.toLowerCase();
    if (ASIDE_TAGS.has(element)) {
      // An aside's start tag also ends an open paragraph, as in HTML.
      aside = Math.max(0, aside + (close ? -1 : 1));
      start = -1;
    } else if (element === "p" && aside === 0) {
      if (!close) {
        start = tag.index + tag[0].length;
      } else if (start >= 0) {
        yield html.slice(start, tag.index);
        start = -1;
      }
    }
  }
}

function textOf(html: string): string {
  return decodeEntities(html.replaceAll(TAG, ""))
    .replaceAll(/\s+/gu, " ")
    .trim();
}

/**
 * The first paragraph of a digest's rendered HTML with any text in it, as
 * plain text; a paragraph quoted or set aside is not the digest's own.
 * Digests open with a summary paragraph under their title; 13,114 of 15,526
 * share one boilerplate frontmatter description, so this is what tells them
 * apart.
 */
export function ledeOf(
  html: string | undefined,
  max: number = LEDE_MAX
): string {
  for (const paragraph of paragraphs(html ?? "")) {
    const text = textOf(paragraph);
    if (text) {
      return clip(text, max);
    }
  }
  return "";
}
