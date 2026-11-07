/** Frontmatter dates: a `YYYY-MM-DD` day or an ISO date-time. */

export const DAY = /^\d{4}-\d{2}-\d{2}$/u;

/** An ISO 8601 day, or date-time with an optional offset (RFC 3339 also
 *  allows a space for the T). */
// oxlint-disable-next-line eslint/one-var -- an exported const cannot join this private one
const ISO =
  /^(?<day>\d{4}-\d{2}-\d{2})(?:[ T](?<time>\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?<zone>Z|[+-]\d{2}:\d{2})?)?$/u;

/** `new Date` rolls 2026-02-30 over to March; a real day prints back the same. */
function isDay(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
  );
}

/**
 * A date, or null unless the text is an ISO 8601 day or date-time. A day is
 * midnight UTC, and so is a date-time without an offset: `new Date` would
 * read it, and prose like "March 5, 2026", in the build machine's zone, so
 * the same corpus would give different pages on different machines.
 */
export function dateOf(text: string | undefined): Date | null {
  const parts = text?.match(ISO)?.groups;
  if (!(parts?.day && isDay(parts.day))) {
    return null;
  }
  // oxlint-disable-next-line eslint/one-var -- built only from a valid day
  const date = new Date(
    `${parts.day}T${parts.time ?? "00:00"}${parts.zone ?? "Z"}`
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
