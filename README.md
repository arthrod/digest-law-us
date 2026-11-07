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

## For agents

`POST https://digest.law/mcp` is a read-only MCP server (stateless
Streamable HTTP). It searches the concept catalog — label, route, page URL,
and the permanent concept IRI — and does not return the prose of a digest.
The server card is at
`https://digest.law/.well-known/mcp/server-card.json`.

Discovery follows live-contracts: every HTML response (the home page
included) sends RFC 8288 `Link` headers to the RFC 9727 API catalog
(`/.well-known/api-catalog`), the server card and the sitemap, and
`/.well-known/agent-skills/index.json` lists a SKILL.md on how to find, cite
and read a topic. robots.txt allows search and AI crawlers and states
`Content-Signal: search=yes, ai-input=yes, ai-train=yes` (policy in
`src/lib/robots.ts`).

The endpoint allows 60 requests per 60 seconds per client IP, the same cap
as Live Contracts, enforced by the `MCP_RATE_LIMITER` binding in
`wrangler.jsonc`. A local `wrangler dev` without that binding still answers.

Any page also comes as markdown: send `Accept: text/markdown` and the root
Worker converts the page with Workers AI `toMarkdown()` (free for HTML),
caches the result per build, and answers `text/markdown` with an
`x-markdown-tokens` header (`worker/markdown.ts`). Browsers never ask for
markdown and get the HTML, now with `Vary: Accept`. Pages over 2 MiB, and
clients past 60 conversions a minute (`MARKDOWN_RATE_LIMITER`), get the HTML
too.

In a browser that supports WebMCP (`navigator.modelContext`), every page
registers the same three read-only tools with the browser's agent; each is a
call to `POST /mcp` (`public/webmcp.js`, loaded by `Layout.astro`). Other
browsers skip it and send nothing.

`https://digest.law/rss.xml` is an RSS 2.0 feed of the 50 most recently
revised digests (`src/lib/feed.ts`). Each item is described by its digest's
own description, its SKOS definition, or the opening paragraph of the
digest, in that order: 13,114 digests share one boilerplate frontmatter
description, which the feed skips. Each revision has its own `guid`, so a
reader shows a digest again when it is revised.

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
