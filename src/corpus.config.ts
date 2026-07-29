/**
 * Where the American Legal Digest corpus lives on disk.
 *
 * The corpus (42 areas / ~1,650 digest bundles, ~1.6 GB) is NOT part of this
 * repository — it lives in the private `key-digest-runner` repo. Builds expect
 * a sibling checkout by default; override with the CORPUS_DIR env var.
 */
export const CORPUS_DIR =
  process.env.CORPUS_DIR ??
  "../key-digest-runner/key_digest/american_legal_digest/okf";

/** Markdown bytes rendered inline per source page (hard constraint 3). */
export const SOURCE_CHUNK_BYTES = 200_000;
