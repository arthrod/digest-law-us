# American Legal Digest — United States (digest-law-us)

[![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-blue.svg)](LICENSE) [![Code: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue.svg)](LICENSE-CODE)

The **United States corpus of the American Legal Digest**: open, source-grounded
digests of U.S. legal issues, one topic bundle per researched issue, with stable,
permanent identifiers.

The corpus currently holds **1,621 digest bundles across 42 areas of U.S. law**
(~16,000 markdown files). Every bundle merged since 2026-07-28 satisfies an
**evidence floor of at least 2 retained public-source documents** — bundles that
could not be grounded in 2 or more sources were purged from the corpus rather
than published thin. Sources are retained in full from **free public legal
authorities only** (CourtListener, GovInfo, eCFR, Cornell LII, court and agency
sites); no proprietary legal database (Westlaw, Lexis, Bloomberg Law, or
similar) is used at any stage.

- **Permanent identifier base:** `https://w3id.org/digest-law/us/`
- **Published site (this repo, GitHub Pages):** https://arthrod.github.io/digest-law-us/
- **Companion vocabulary:** the [Open Legal Issue Taxonomy (OLIT)](https://w3id.org/legal-taxonomy/) —
  digest topics carry SKOS frontmatter (`broader` / `narrower` / `related`) tied to the same
  issue hierarchy.

## Identifiers

| Thing | Pattern |
|-------|---------|
| Digest bundle (topic) | `https://w3id.org/digest-law/us/{area}/{topic}/` |
| Retained source | `https://w3id.org/digest-law/us/{area}/{topic}/sources/{slug}/` |
| Audit trail | `https://w3id.org/digest-law/us/{area}/{topic}/audit/` |

The `digest-law` w3id namespace is organised by jurisdiction; `us/` is the first
(and currently only) jurisdiction. The namespace root and all `us/…` paths
redirect here.

## What a digest bundle is

Each bundle is the complete output of one research run on one legal issue:

- `digest.md` — the digest itself: the issue explained against its retained
  authorities, with inline citations linking to the sources below;
- `sources/` — the retained source documents, in full, as fetched (minimum 2);
- an **audit trail** — the machine-readable run record (`run.json`, append-only)
  and snippet audits documenting which passages of which sources support the
  digest.

Digests are **machine-generated and machine-reviewed**: an automated reviewer
merges a bundle only after a 21-item gate that includes the evidence floor,
citation-to-source verification, and provenance checks. The full corpus and its
audit trails are published so every claim can be traced to a retained source.

## Status

- The **identifier namespace and this landing repo are live**.
- The full browsable site (per-bundle pages, search, source viewers) is **in
  preparation** — an Astro static build, to be served at the working domain
  **digest.law** with `w3id.org/digest-law/us/…` as the permanent identifiers.
- Until the full site ships, identifier URLs resolve to this repository's pages.

## Licensing

- **Digests, audit data, and documentation** — CC BY 4.0 (see [`LICENSE`](LICENSE)).
- **Code** (site build, tooling) — Apache-2.0 (see [`LICENSE-CODE`](LICENSE-CODE)).
- Retained source documents are U.S. public records and public-domain or
  openly published legal materials; see [`NOTICE.md`](NOTICE.md).

**This is a research corpus, not legal advice.** See the notice.

## Cite as

> Rodrigues, Arthur S. *American Legal Digest — United States.* 2026.
> https://w3id.org/digest-law/us/ — CC BY 4.0.

**Maintainer:** Arthur S. Rodrigues — arthursrodrigues@gmail.com — GitHub: [@arthrod](https://github.com/arthrod)
