/**
 * `/rss.xml`: the most recently revised digests, newest first.
 *
 * Pure functions over plain data, so the feed can be tested without a
 * build; src/pages/rss.xml.ts feeds them the corpus and hands the result to
 * `@astrojs/rss`. This module is imported by that one route only, so a
 * change here re-renders one file, not the corpus (rebuild tier 1).
 */
import type { RSSFeedItem, RSSOptions } from "@astrojs/rss";

import type { Corpus } from "./corpus";
import { SITE_BASE } from "./iri";
import { humanize } from "./labels";
import { pageUrl } from "./skos";

/** Items in the feed. */
export const FEED_SIZE = 50;

/** One digest, as much of it as the feed needs. */
export interface FeedDigest {
  /** Label of the digest's area (the first breadcrumb). */
  area: string;
  definition: string;
  description: string;
  label: string;
  /** The digest's opening paragraph, as plain text (see withLedes). */
  lede?: string;
  /** Frontmatter `modified`: a `YYYY-MM-DD` day on 15,494 of 15,526 digests. */
  modified?: string;
  slugPath: string;
  /** Frontmatter `timestamp`: an ISO date-time, when the digest was generated. */
  timestamp?: string;
}

export interface FeedEntry extends FeedDigest {
  revised: Date;
}

// oxlint-disable-next-line eslint/one-var -- an exported const cannot join this private list
const DAY = /^\d{4}-\d{2}-\d{2}$/u,
  ENTITY =
    /&(?:#(?<dec>\d+)|#x(?<hex>[\da-f]+)|(?<name>amp|apos|gt|lt|nbsp|quot));/giu,
  FEED_URL = `${SITE_BASE}rss.xml`,
  /** A lede longer than this is cut at a word and ends with an ellipsis. */
  LEDE_MAX = 280,
  NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  },
  PARAGRAPH = /<p(?:\s[^>]*)?>(?<text>[\s\S]*?)<\/p>/u,
  TAG = /<[^>]*>/gu,
  XML_ESCAPES: Record<string, string> = {
    '"': "&quot;",
    "&": "&amp;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;",
  };

function escapeXml(text: string): string {
  return text.replaceAll(/["&'<>]/gu, (char) => XML_ESCAPES[char] ?? char);
}

/** A date, or null when the text does not read as one. */
function dateOf(text: string | undefined): Date | null {
  if (!text) {
    return null;
  }
  const date = new Date(DAY.test(text) ? `${text}T00:00:00Z` : text);
  // `new Date("2026-13-45")` is Invalid Date, but `Date.parse` of some
  // day-only strings rolls over; a valid day must also print back the same.
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return DAY.test(text) && date.toISOString().slice(0, 10) !== text
    ? null
    : date;
}

/**
 * When a digest was last revised. `modified` is the revision day; the
 * generation `timestamp` gives the time of day only when it falls on that
 * same day (a digest revised after it was generated keeps its revision day,
 * at midnight UTC). With no readable `modified`, the timestamp stands alone.
 */
export function revisedAt(modified?: string, timestamp?: string): Date | null {
  const revised = dateOf(modified),
    stamp = dateOf(timestamp);
  if (!revised) {
    return stamp;
  }
  if (
    modified &&
    DAY.test(modified) &&
    stamp?.toISOString().slice(0, 10) === modified
  ) {
    return stamp;
  }
  return revised;
}

/**
 * What an item says about its digest: the frontmatter description, then the
 * SKOS definition, then the digest's opening paragraph, then the generic
 * sentence. DigestView.astro uses the same order without the opening
 * paragraph. feedDigests() has already dropped boilerplate descriptions.
 */
export function digestDescription(
  digest: Pick<
    FeedDigest,
    "area" | "definition" | "description" | "label" | "lede"
  >
): string {
  return (
    digest.description ||
    digest.definition ||
    digest.lede ||
    `Digest of ${digest.label} in ${digest.area}, with retained sources and audit.`
  );
}

function decodeEntities(text: string): string {
  return text.replaceAll(ENTITY, (match, ...args: unknown[]) => {
    const groups = args.at(-1) as { dec?: string; hex?: string; name?: string };
    if (groups.dec) {
      return String.fromCodePoint(Number(groups.dec));
    }
    if (groups.hex) {
      return String.fromCodePoint(Number.parseInt(groups.hex, 16));
    }
    return NAMED_ENTITIES[groups.name?.toLowerCase() ?? ""] ?? match;
  });
}

/** Text over LEDE_MAX is cut at the last whole word and given an ellipsis. */
function clip(text: string): string {
  if (text.length <= LEDE_MAX) {
    return text;
  }
  const cut = text.slice(0, LEDE_MAX - 1),
    space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The first paragraph of a digest's rendered HTML, as plain text. Digests
 * open with a summary paragraph under their title; 13,114 of 15,526 share
 * one boilerplate frontmatter description, so this is what tells them apart.
 */
export function ledeOf(html: string | undefined): string {
  const paragraph = html?.match(PARAGRAPH)?.groups?.text;
  if (!paragraph) {
    return "";
  }
  return clip(
    decodeEntities(paragraph.replaceAll(TAG, ""))
      .replaceAll(/\s+/gu, " ")
      .trim()
  );
}

/** The `size` most recently revised digests, newest first; ties by path. */
export function recentlyRevised(
  digests: Iterable<FeedDigest>,
  size: number = FEED_SIZE
): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const digest of digests) {
    const revised = revisedAt(digest.modified, digest.timestamp);
    if (revised) {
      entries.push({ ...digest, revised });
    }
  }
  return entries
    .toSorted(
      (a, b) =>
        b.revised.getTime() - a.revised.getTime() ||
        a.slugPath.localeCompare(b.slugPath)
    )
    .slice(0, size);
}

type DigestData = Partial<Record<keyof FeedDigest, string | undefined>>;

/**
 * Every digest in the corpus tree, with its area's label. A description
 * shared with any other digest is boilerplate written by the research run
 * ("Derived from retained sources of the research run." on 13,114 digests),
 * not a description, so it is dropped.
 */
export function feedDigests(
  corpus: Pick<Corpus, "nodeBySlugPath">
): FeedDigest[] {
  const digests = [...corpus.nodeBySlugPath.values()].flatMap((node) =>
      node.digest ? [{ data: node.digest.data as DigestData, node }] : []
    ),
    uses = new Map<string, number>();
  for (const { data } of digests) {
    const description = data.description ?? "";
    uses.set(description, (uses.get(description) ?? 0) + 1);
  }
  return digests.map(({ data, node }) => {
    const [area = ""] = node.slugPath.split("/"),
      description = data.description ?? "";
    return {
      area: corpus.nodeBySlugPath.get(area)?.label ?? humanize(area),
      definition: data.definition ?? "",
      description: (uses.get(description) ?? 0) > 1 ? "" : description,
      label: node.label,
      modified: data.modified,
      slugPath: node.slugPath,
      timestamp: data.timestamp,
    };
  });
}

/**
 * The entries with their digests' opening paragraphs. Run on the chosen
 * entries only: it reads each one's rendered HTML.
 */
export function withLedes(
  entries: FeedEntry[],
  corpus: Pick<Corpus, "nodeBySlugPath">
): FeedEntry[] {
  return entries.map((entry) => ({
    ...entry,
    lede: ledeOf(
      corpus.nodeBySlugPath.get(entry.slugPath)?.digest?.rendered?.html
    ),
  }));
}

function feedItem(entry: FeedEntry): RSSFeedItem {
  const day = entry.revised.toISOString().slice(0, 10),
    link = pageUrl(entry.slugPath);
  return {
    categories: [entry.area],
    // One guid per revision: readers that saw an earlier revision show the
    // digest again when it is revised.
    customData: `<guid isPermaLink="false">${escapeXml(`${link}#revised-${day}`)}</guid>`,
    description: digestDescription(entry),
    link,
    pubDate: entry.revised,
    title: entry.label,
  };
}

/** Options for `@astrojs/rss`. Deterministic: the same corpus gives the same bytes. */
export function feedOptions(entries: FeedEntry[]): RSSOptions {
  const [newest] = entries,
    channel = [
      "<language>en-us</language>",
      `<atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>`,
    ];
  if (newest) {
    channel.push(
      `<lastBuildDate>${newest.revised.toUTCString()}</lastBuildDate>`
    );
  }
  return {
    customData: channel.join(""),
    description: `The ${FEED_SIZE} most recently revised digests in the American Legal Digest, a public reference of American law with retained primary sources.`,
    items: entries.map(feedItem),
    site: SITE_BASE,
    title: "American Legal Digest — recently revised",
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
  };
}
