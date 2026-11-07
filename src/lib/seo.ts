/**
 * Values for the <head> of every page (Layout.astro). Kept apart from the
 * views so they can be tested; scripts/check-head.ts checks the built pages.
 */
import { SITE } from "../config";
import { DAY, dateOf } from "./dates";

/** The feed's title, for <link rel="alternate"> and the feed itself. */
export const FEED_TITLE = "American Legal Digest — recently revised",
  /** public/default-og.jpg, the image every page shares. */
  OG_IMAGE = { alt: "American Legal Digest", height: 630, width: 1200 },
  OG_LOCALE = "en_US";

export interface ArticleMeta {
  /** Last revision: frontmatter `modified`, else `timestamp`. */
  modified?: string;
  /** First publication: frontmatter `created`. */
  published?: string;
  /** The digest's area. */
  section?: string;
}

/**
 * Size and alt text for a page's social image: known for the default image
 * (OG_IMAGE, measured in seo.test.ts), not for one a page brings itself,
 * whose tags are then left out rather than made to contradict it.
 */
export function ogImageMeta(ogImage: string): typeof OG_IMAGE | null {
  return ogImage === `/${SITE.ogImage}` ? OG_IMAGE : null;
}

/** A day stays a day; a date-time is normalized to UTC ISO 8601. */
export function isoTime(text: string | undefined): string | null {
  const date = dateOf(text);
  if (!(date && text)) {
    return null;
  }
  return DAY.test(text) ? text : date.toISOString();
}

/** Open Graph `article:*` tags for a digest page; unreadable values are left out. */
export function articleTags(
  article?: ArticleMeta
): { content: string; property: string }[] {
  if (!article) {
    return [];
  }
  const modified = isoTime(article.modified),
    published = isoTime(article.published),
    tags: { content: string; property: string }[] = [];
  if (published) {
    tags.push({ content: published, property: "article:published_time" });
  }
  if (modified) {
    tags.push({ content: modified, property: "article:modified_time" });
  }
  if (article.section) {
    tags.push({ content: article.section, property: "article:section" });
  }
  return tags;
}
