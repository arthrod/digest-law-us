/**
 * Purge events — the evidence floor, enforced by deletion.
 *
 * Every time the floor is applied, the runner writes a manifest naming each
 * bundle it removed: `docs/YYYY-MM-DD-purge-<reason>.tsv`, one row per
 * deleted bundle. This module counts those rows at build time, so the purge
 * figures the site publishes are the deletion record itself rather than a
 * number somebody typed into a page and forgot to update.
 *
 * If no manifest is readable the counts come back empty and the pages drop
 * their purge claims entirely. A reference that reports absence does not get
 * to guess at its own numbers either.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { PURGE_DIR } from "@/corpus.config";

export interface PurgeEvent {
  /** bundles deleted in this purge */
  count: number;
  /** ISO date (YYYY-MM-DD) taken from the manifest filename */
  date: string;
  /** manifest basename — the citable record */
  file: string;
  /** slug between the date and `.tsv`, e.g. "le1" */
  reason: string;
}

export interface PurgeSummary {
  /** every purge, oldest first */
  events: PurgeEvent[];
  /** most recent purge, or null when no manifest was readable */
  latest: PurgeEvent | null;
  /** bundles deleted across every purge */
  total: number;
}

/** `2026-07-28-purge-le1-manifest.tsv` → date `2026-07-28`, reason `le1` */
const MANIFEST_RE =
  /^(?<date>\d{4}-\d{2}-\d{2})-purge-(?<reason>.+?)(?:-manifest)?\.tsv$/u;

/**
 * Data rows in a manifest. The first line is a `path\tsources\taction`
 * header; blank trailing lines are ignored. Counted by row rather than by
 * `wc -l` so a missing trailing newline cannot shift the published number.
 */
function countRows(tsv: string): number {
  let count = 0,
   isFirst = true;
  for (const line of tsv.split("\n")) {
    const row = line.trim();
    if (row === "") {
      continue;
    }
    if (isFirst) {
      isFirst = false;
      // Only skip a real header — a manifest written without one still counts.
      if (row.startsWith("path\t")) {
        continue;
      }
    }
    count += 1;
  }
  return count;
}

let summaryPromise: Promise<PurgeSummary> | null = null;

async function build(): Promise<PurgeSummary> {
  const empty: PurgeSummary = { events: [], latest: null, total: 0 };

  let names: string[];
  try {
    names = await fs.readdir(PURGE_DIR);
  } catch {
    console.warn(
      `[purge] no manifest directory at ${PURGE_DIR} — purge figures omitted from the site`
    );
    return empty;
  }

  const events: PurgeEvent[] = [];
  for (const name of names) {
    const match = MANIFEST_RE.exec(name);
    if (!match?.groups) {
      continue;
    }
    let tsv: string;
    try {
      tsv = await fs.readFile(path.join(PURGE_DIR, name), "utf8");
    } catch (error) {
      console.warn(`[purge] unreadable manifest ${name}: ${String(error)}`);
      continue;
    }
    const count = countRows(tsv);
    if (count === 0) {
      console.warn(`[purge] manifest ${name} has no rows — skipped`);
      continue;
    }
    events.push({
      count,
      date: match.groups.date,
      file: name,
      reason: match.groups.reason,
    });
  }

  if (events.length === 0) {
    console.warn(`[purge] no purge manifests found in ${PURGE_DIR}`);
    return empty;
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return {
    events,
    latest: events.at(-1) ?? null,
    total: events.reduce((n, e) => n + e.count, 0),
  };
}

export function getPurge(): Promise<PurgeSummary> {
  summaryPromise ??= build();
  return summaryPromise;
}
