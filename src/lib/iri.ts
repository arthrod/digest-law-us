/**
 * Identifier namespaces and URN resolution — no corpus, no content
 * collections, so this module is importable from tests and scripts.
 *
 * Identity note (P1-001 / S-01): `CONCEPT_BASE` is the permanent concept
 * namespace. It is minted from the registry in `concept-ids.ts`, never from a
 * route. `W3ID_BASE` remains the concept-scheme IRI and the *legacy* route
 * namespace of already-published concept IRIs; those legacy IRIs are still
 * published per concept as `digest:legacyIri` so nothing that was cited stops
 * resolving (P1-002).
 *
 * None of these w3id.org namespaces are configured to redirect yet — the
 * redirect PR is P1-014G and is tracked as PENDING in the ledger.
 */

import { humanize, slugSegment } from "./labels";

/** Concept scheme IRI, and the prefix of legacy route-derived concept IRIs. */
export const W3ID_BASE = "https://w3id.org/digest-law/us/";

/** Permanent, route-independent concept namespace. */
export const CONCEPT_BASE = "https://w3id.org/digest-law/concept/";

/** Project vocabulary: terms this project defines because SKOS has none. */
export const VOCAB_BASE = "https://w3id.org/digest-law/vocab/";

/** Datatype namespace; `concept-id` types the canonical `skos:notation`. */
export const DATATYPE_BASE = "https://w3id.org/digest-law/datatype/";

export const CONCEPT_ID_DATATYPE = `${DATATYPE_BASE}concept-id`;

/** Where the human-readable pages live. */
export const SITE_BASE = "https://digest.law/";

/**
 * BCP 47 tag for the principal language of this jurisdiction package.
 *
 * This is the *fallback* only. Per-record `language` is honoured when the
 * corpus carries it; as of 2026-07-31 no digest does (measured: 0 of 1,811),
 * so every literal currently falls back to this constant. That absence is the
 * open half of P1-014I — the exporter no longer hard-codes a tag, but the data
 * still has nothing better to say.
 */
export const SCHEME_LANGUAGE = "en";

/**
 * Well-formed BCP 47 tag, syntactically (not registry-validated).
 *
 * Language, then script/region/variant subtags of 2-8 characters, then the two
 * sections a naive `{2,8}` pattern gets wrong because they are introduced by a
 * SINGLE character: extensions (`en-u-nu-latn`) and private use (`en-x-test`).
 * Rejecting those is not a harmless strictness — `languageOf` falls back to
 * SCHEME_LANGUAGE, so a valid tag would be silently replaced by "en" and the
 * published literal would assert the wrong language. Saying nothing is better
 * than saying something false, and saying the truth is better than both.
 */
const BCP47 =
  /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*(?:-[0-9a-wyzA-WYZ](?:-[a-zA-Z0-9]{2,8})+)*(?:-[xX](?:-[a-zA-Z0-9]{1,8})+)?$/u;

export function isBcp47(tag: unknown): tag is string {
  return typeof tag === "string" && BCP47.test(tag);
}

export interface ResolvedRef {
  label: string;
  /** true when a page exists on this site for the ref */
  published: boolean;
  /** lowercase-kebab path derived from the URN — always defined */
  slugPath: string;
  urn: string;
}

export function urnToSlugPath(urn: string): string {
  const notation = urn.replace(/^urn:legal-taxonomy:issue:/u, "");
  return notation.split(".").map(slugSegment).join("/");
}

/** Resolve a corpus URN against a slug-path index (pure; see corpus.ts). */
export function resolveRefIn(
  nodeBySlugPath: Map<string, { label: string }>,
  urn: string
): ResolvedRef {
  const slugPath = urnToSlugPath(urn);
  const node = nodeBySlugPath.get(slugPath);
  const lastSeg =
    urn
      .replace(/^urn:legal-taxonomy:issue:/u, "")
      .split(".")
      .pop() ?? urn;
  return {
    label: node?.label ?? humanize(lastSeg),
    published: Boolean(node),
    slugPath,
    urn,
  };
}
