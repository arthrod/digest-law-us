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
