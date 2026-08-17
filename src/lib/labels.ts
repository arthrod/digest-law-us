/**
 * Label + slug helpers for corpus directory segments.
 *
 * Corpus names arrive in two families — Title_Case ("Banking_Law") and
 * SCREAMING_SNAKE ("JUDICIAL_PRECEDENTS_AND_CASE_LAW"). Display is
 * title-cased with legal small-word rules; URLs are the lowercase-kebab
 * mirror of the tree (stable, citable).
 */

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "v",
  "vs",
  "via",
  "with",
]);

/** "JUDICIAL_PRECEDENTS_AND_CASE_LAW" → "Judicial Precedents and Case Law" */
export function humanize(segment: string): string {
  const words = segment.replaceAll("_", " ").trim().split(/\s+/u),
   isScreaming = segment === segment.toUpperCase();
  if (!isScreaming) {
    return words.join(" ");
  }
  return words
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i !== 0 && i !== words.length - 1 && SMALL_WORDS.has(lw)) {
        return lw;
      }
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
}

/** "INSOLVENT_BANKS" and "Insolvent_Banks" both → "insolvent-banks" */
export function slugSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
}

/** Corpus directory path → site URL path (no leading/trailing slash). */
export function slugPathOf(dirPath: string): string {
  return dirPath.split("/").map(slugSegment).join("/");
}

/** "2026-07-16T12:18:39Z" or "2026-07-16" → "16 Jul 2026" (UTC, stable). */
export function formatDate(value: string | Date | undefined): string {
  if (!value) {
    return "";
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Human file size: "5.6 GB", "12.5 MB", "188 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1000) {
    return `${Math.round(bytes / 1000)} KB`;
  }
  return `${bytes} B`;
}
