/**
 * Where the American Legal Digest corpus lives on disk.
 *
 * The corpus (42 areas / ~1,650 digest bundles, ~1.6 GB) is NOT part of this
 * repository — it lives in the private `key-digest-runner` repo. Builds expect
 * a sibling checkout by default; override with the CORPUS_DIR env var.
 */
export const CORPUS_DIR =
<<<<<<< HEAD
  process.env.CORPUS_DIR ??
  "../key-digest-runner/key_digest/american_legal_digest/okf";
=======
  process.env.CORPUS_DIR ?? "../key-digest-runner/key_digest/american_legal_digest/okf";
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

/** Markdown bytes rendered inline per source page (hard constraint 3). */
export const SOURCE_CHUNK_BYTES = 200_000;
