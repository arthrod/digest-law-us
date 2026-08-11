/**
 * Where the American Legal Digest corpus lives on disk.
 *
 * The corpus is NOT part of this repository — it lives in the private
 * `key-digest-runner` repo. Builds expect a sibling checkout by default;
 * override with the CORPUS_DIR env var. Every count the site publishes is
 * derived from that checkout at build time, so no figure is written here.
 */
export const CORPUS_DIR =
  process.env.CORPUS_DIR ??
  "../key-digest-runner/key_digest/american_legal_digest/okf";

/**
 * Where the purge manifests live — same repo as the corpus, one level above
 * `key_digest/`. Each `YYYY-MM-DD-purge-*.tsv` is the deletion record for one
 * enforcement of the evidence floor, and it is the ONLY source for the purge
 * counts the site publishes (see src/lib/purge.ts). Override with PURGE_DIR.
 */
export const PURGE_DIR = process.env.PURGE_DIR ?? "../key-digest-runner/docs";

/** Markdown bytes rendered inline per source page (hard constraint 3). */
export const SOURCE_CHUNK_BYTES = 200_000;

/**
 * Preview mode — a deliberately tiny build for style and content iteration.
 *
 * Full builds skip unchanged pages via `experimental.incrementalBuild`
 * (see astro.config.ts and src/lib/cache-keys.ts), but that only helps
 * when code is untouched — any edit to a shared component re-renders all
 * ~57k pages. Preview mode is for exactly that loop: it caps the corpus at
 * a handful of digest bundles (chosen to exercise every view: audit,
 * caselaw, statutory, multi-chunk sources) so `build:preview` finishes in
 * seconds regardless of what changed. Output goes to `dist-preview/` with
 * its own cacheDir (see astro.config.ts) so a full `dist/` and its
 * incremental cache are never clobbered. Preview builds are for local
 * iteration only — `deploy` never sets these variables.
 *
 * - PREVIEW_BUNDLES=10   keep at most N digest bundles (area round-robin)
 * - PREVIEW_PATHS=a,b/c  keep bundles under these corpus or slug paths
 */
export const PREVIEW_BUNDLES =
  Math.trunc(Number(process.env.PREVIEW_BUNDLES ?? "")) || 0;

export const PREVIEW_PATHS = (process.env.PREVIEW_PATHS ?? "")
  .split(",")
  .map((p) => p.trim().replaceAll(/^\/|\/$/gu, ""))
  .filter(Boolean);

export const PREVIEW_MODE = PREVIEW_BUNDLES > 0 || PREVIEW_PATHS.length > 0;
