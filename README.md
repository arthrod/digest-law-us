# digest.law — American Legal Digest (United States)

The public documentation site for the **American Legal Digest**: open,
source-grounded digests of United States legal doctrine, machine-researched
from free public sources, review-gated, and published with every retained
source and every search log attached.

- **Site:** https://digest.law
- **Permanent identifiers:** https://w3id.org/digest-law/us/
- **Machine-readable scheme:** https://digest.law/skos.jsonld
- **Companion vocabulary:** https://w3id.org/legal-taxonomy/ (Open Legal
  Issue Taxonomy)

## What is published

Every digest bundle is one researched legal issue:

| Piece                        | URL                                                              |
| ---------------------------- | ---------------------------------------------------------------- |
| The digest                   | `/{area}/…/{topic}/`                                             |
| Retained sources (full text) | `/{area}/…/{topic}/sources/{slug}/` (+ `/2/…/n/` for long texts) |
| Audit trail (build log)      | `/{area}/…/{topic}/audit/`                                       |
| Tables of authorities        | `/{area}/…/{topic}/caselaw/` · `…/statutory/`                    |
| Provenance manifest          | `/provenance/{area}/…/{topic}.json`                              |

| Thing                 | Pattern                                                         |
| --------------------- | --------------------------------------------------------------- |
| Digest bundle (topic) | `https://w3id.org/digest-law/us/{area}/{topic}/`                |
| Retained source       | `https://w3id.org/digest-law/us/{area}/{topic}/sources/{slug}/` |
| Audit trail           | `https://w3id.org/digest-law/us/{area}/{topic}/audit/`          |

## Architecture

Astro static site (AstroPaper v6 base), Astro-native throughout:

- **Content collections** (`src/content.config.ts`) glob-load the corpus:
  digests (SKOS `legal_issue` frontmatter), audits, caselaw/statutory
  indexes, and `run.json` provenance manifests.
- **Sources** (~372 MB of retained markdown, single files up to 12.5 MB)
  never enter the content-layer store: a custom loader
  (`src/loaders/sources.ts`) records metadata + chunk offsets only, and each
  source page renders exactly its own ≤200 KB slice at build time with
  Astro's markdown pipeline (`src/lib/render-md.ts`).
- **Search** is Pagefind, indexed post-build, with `area` and `kind` filters.
- **Design tokens** (`src/styles/theme.css`) come from the design handoff —
  near-monochrome ink on paper, one accent (Michigan blue) marking exactly
  one thing: documents we hold. Light/dark are designed palettes; print is a
  first-class stylesheet.
- **JS is opt-in**: theme toggle, TOC scroll-highlight, search page, and a
  keyboard shortcut — every page is fully readable with JS disabled (area
  trees collapse via native `<details>`; long sources paginate via real
  chunk routes).

Hard constraints (learned from a failed publish, structural here): no global
navigation tree inlined into pages (route-scoped trees; the full map lives
on `/` and `/sitemap/` only); no monolithic search index; giant sources
never produce giant pages.

## SKOS

Digest topics are `skos:Concept`s with permanent w3id IRIs. Every digest
page embeds its concept as JSON-LD (prefLabel/altLabel/hiddenLabel,
definition, scopeNote, notation, broader/narrower/related, closeMatch to
FOLIO and friends), plus a schema.org `Article`; source pages embed
`ArchiveComponent`. The full `skos:ConceptScheme` is published at
`/skos.jsonld`. Relations to not-yet-published topics keep their IRIs —
identifiers exist before pages do — and render as muted, unlinked chips,
never dead links, never dropped.

## Building

The corpus is **not** in this repository — it lives in a private research
repo. Builds expect a sibling checkout (see `src/corpus.config.ts`) or an
explicit override:

```sh
pnpm install
CORPUS_DIR=/path/to/okf pnpm build   # astro build + pagefind
pnpm deploy                          # build + wrangler deploy (Cloudflare)
```

## Licensing

Digest text: [Creative Commons Attribution 4.0 International Public
License](https://creativecommons.org/licenses/by/4.0/) — reuse anywhere,
with attribution. Retained sources: public domain or as-licensed by their
issuing authority (17 U.S.C. § 105; _Georgia v. Public.Resource.Org_, 590
U.S. 255 (2020)). Site code: [Apache License
2.0](https://www.apache.org/licenses/LICENSE-2.0) — see `LICENSE-CODE`. The
AstroPaper base retains its own MIT notice in `LICENSE-THEME`.

Digests are machine-generated and machine-reviewed. They are a map of
doctrine pointing at authorities — not a treatise, and **not legal advice**.

## Cite as

> Digest, LLC. _American Legal Digest — United States._ 2026.
> https://w3id.org/digest-law/us/ — CC BY 4.0.

**Maintainer:** Arthur S. Rodrigues — arthursrodrigues@gmail.com — GitHub: [@arthrod](https://github.com/arthrod)
