# SEO and agent readiness: what to take from live-contracts and astro-arthur

2026-11-07. A survey of the SEO, Open Graph, JSON-LD, `.well-known`, MCP,
search, and RSS features in `../live-contracts` (frontend) and
`../astro-arthur` (main), checked against digest.law, with what this repo
adopts and what it does not.

## The constraint that decides everything

digest.law is ~358,000 pages. The last build (2026-11-03) took 132 min of
warm content sync and 1,147 min of rendering. So each change is judged by
what it forces:

| Tier | Touches                                                                                      | Forces                                                    | Wall clock               |
| ---- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| 0    | `worker/`, `wrangler.jsonc`, root-level files written after `astro build`, `public/_headers` | `deploy --only=root` (root is ~30 files)                  | minutes                  |
| 1    | a new or changed route that renders one file (`robots.txt.ts`, `rss.xml.ts`)                 | a build: warm sync, then only the changed routes render   | ~2.5 h, plus deploy      |
| 2    | `Layout.astro`, `Crumbs.astro`, anything every view imports                                  | every page re-renders, every shard redeploys              | ~20 h build, ~8 h deploy |
| 3    | `astro.config.ts`, `content.config.ts`, a new Astro integration                              | "Astro config changed": a cold content sync before tier 2 | +4 h on top of tier 2    |

Rules that follow from the table:

- Agent-facing features go in tier 0 (the root Worker and root-level files)
  wherever they can.
- Tier 2 changes ship as **one** batch, merged right before a planned full
  build.
- No new Astro integrations. Every integration astro-arthur uses is a tier 3
  change here, and each has a tier 0 or tier 1 equivalent.

One routing fact matters for tier 0. `run_worker_first` is a list of globs.
Every shard folder is on it, so shard pages pass through the Worker. Root-level
files do not: `/` (the home page) is served straight from assets, and the
Worker never sees it.

## Baseline (isitagentready.com `scan_site`, profile `apiApp`, 2026-11-07)

| Site                      | Level | Passing | Notable passes                                                                                            |
| ------------------------- | ----- | ------- | --------------------------------------------------------------------------------------------------------- |
| digest.law                | 1 / 5 | 3 / 16  | robots.txt, sitemap, AI bot rules (wildcard)                                                              |
| arthur.law                | 1 / 5 | 5 / 16  | + Link header (`describedby`), agent skills index                                                         |
| live-contracts.arthur.law | 4 / 5 | 10 / 16 | + Link headers, markdown negotiation, Content Signals, API catalog, MCP server card, agent skills, WebMCP |

None of the three sites passes `dnsAid`, OAuth, Auth.md, A2A or ARD.

## Production finding: `/mcp` is deployed but cannot answer

The uncommitted MCP work (worker/mcp.ts) was deployed to the root Worker on
2026-11-06 without a build. The Worker reads `/mcp-catalog.json`, which only
`astro build` produces, so it does not exist in production:

```
POST https://digest.law/mcp  tools/call search_concepts
→ {"result":{"content":[{"text":"Concept catalog is unavailable."}],"isError":true}}
GET  https://digest.law/.well-known/mcp/server-card.json  → 404
```

Shard pages already carry a `Link: rel="service-desc"` header that points at
that 404. There is a second problem: a `dist/.well-known/` folder would be
treated as a shard folder by `scripts/deploy-shards.ts`, so a root-only
deploy could never ship it.

## Inventory

Verdicts: **adopt** = port as is; **adapt** = port the idea at a cheaper tier;
**have** = digest.law already has it; **reject** = see the reason.

| Feature                                                     | live-contracts                                                           | astro-arthur                                                                   | digest.law today                                                                                 | Verdict                                                                                                                                                                               | Tier  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Native MCP server (stateless Streamable HTTP, rate-limited) | `src/pages/mcp.ts` + `MCP_RATE_LIMITER`                                  | —                                                                              | deployed, broken (above)                                                                         | **adapt**: build the catalog after `astro build` with a script, so a root-only deploy can ship it                                                                                     | 0     |
| MCP server card `/.well-known/mcp/server-card.json`         | static file                                                              | —                                                                              | written, never shipped                                                                           | **adopt** + keep dot-folders on root                                                                                                                                                  | 0     |
| API catalog `/.well-known/api-catalog` (RFC 9727 linkset)   | static file + `_headers` content type                                    | —                                                                              | none                                                                                             | **adopt**                                                                                                                                                                             | 0     |
| Agent skills index `/.well-known/agent-skills/index.json`   | one `mcp` entry                                                          | `astro-skills` integration, 11 SKILL.md                                        | none                                                                                             | **adapt**: static index + one SKILL.md, digest checked by a test (no integration)                                                                                                     | 0     |
| Link headers (RFC 8288)                                     | middleware on every HTML response                                        | `_headers` on `/` only                                                         | shard pages only, and it points at a 404                                                         | **adopt**: Worker on every HTML response; add `/` to `run_worker_first`                                                                                                               | 0     |
| Markdown content negotiation                                | middleware renders markdown from D1                                      | —                                                                              | none                                                                                             | **adapt**: Worker calls `env.AI.toMarkdown()` (free for HTML) on `Accept: text/markdown`, cached. The zone-level "Markdown for Agents" switch needs a Pro plan; digest.law is on Free | 0     |
| robots.txt AI bot rules + Content Signals                   | explicit bots + `Content-Signal: search=yes, ai-input=yes, ai-train=yes` | `astro-robots-txt`                                                             | wildcard allow, no signals                                                                       | **adopt** (policy: CC BY 4.0 content, so all three `yes`; owner to confirm)                                                                                                           | 1     |
| WebMCP (`navigator.modelContext`)                           | inline script in `Base.astro`                                            | —                                                                              | none                                                                                             | **adapt**: root-level `/webmcp.js` that calls the same `/mcp`, one `<script>` tag                                                                                                     | 0 + 2 |
| DNS-AID (`_index`, `_mcp` SVCB under `_agents`)             | `scripts/setup-dns-aid.sh`                                               | —                                                                              | none                                                                                             | **adopt** as a script; running it needs a DNS-edit token and DNSSEC on the zone                                                                                                       | owner |
| Production smoke test                                       | `test/smoke-prod.sh`                                                     | —                                                                              | none                                                                                             | **adopt** for digest.law                                                                                                                                                              | —     |
| Config invariants test                                      | `test/wrangler-config.test.ts`                                           | —                                                                              | partial (`worker/*.test.ts`)                                                                     | **adopt** for `run_worker_first` and the rate limiter                                                                                                                                 | —     |
| RSS feed                                                    | —                                                                        | `@astrojs/rss` skill (unused; starter removed)                                 | `@astrojs/rss` installed, no route                                                               | **adopt**: `/rss.xml`, most recently modified digests                                                                                                                                 | 1     |
| JSON-LD                                                     | —                                                                        | `src/lib/seo.ts`: Organization, Person, BreadcrumbList, ItemList, CreativeWork | SKOS Concept + schema.org Article on digests, ArchiveComponent on sources, ConceptScheme on home | **adapt**: BreadcrumbList (from `Crumbs`), WebSite + Organization on home, `license`/`publisher`/`inLanguage`/`datePublished` on Article                                              | 2     |
| Open Graph / Twitter meta                                   | `<title>` + description only                                             | full `BaseHead`: og:type article, article:*, og:locale, twitter `name=`        | all pages `og:type=website`; `twitter:*` uses `property=`                                        | **adapt**: article type and times on digests, og:image size/alt. `property=` for twitter stays: X reads it, and changing it alone is not worth a full re-render                       | 2     |
| Per-page OG images                                          | —                                                                        | `astro-opengraph-images` (one PNG per page)                                    | one 1200×630 `default-og.jpg`                                                                    | **reject**: 358k PNG renders and 358k more assets past the shard budget. If ever wanted: generate them on demand in the Worker and cache them                                         | —     |
| Sitemap                                                     | SSR `sitemap.xml.ts` (D1)                                                | `astro-sitemap` with i18n                                                      | `@astrojs/sitemap`, 8 files                                                                      | **have**. `lastmod` would need a `serialize` hook (tier 3); do it with the next Astro upgrade, which forces a cold sync anyway                                                        | 3     |
| Search                                                      | D1 FTS5                                                                  | `astro-pagefind`                                                               | Pagefind CLI, 712 MB index                                                                       | **have**. Full-text MCP search over digest prose (D1 FTS5 or Pagefind) is a later project                                                                                             | —     |
| Web app manifest                                            | —                                                                        | `astro-webmanifest`                                                            | none                                                                                             | **reject** for now: a reference site gains little from being installable                                                                                                              | —     |
| purgecss, GTM, Lenis, rollup visualizer                     | —                                                                        | integrations                                                                   | —                                                                                                | **reject**: Tailwind 4 already emits only used classes; purgecss would rescan 358k files; no tracking                                                                                 | —     |
| i18n, hreflang, Paraglide                                   | —                                                                        | yes                                                                            | English only                                                                                     | **reject**                                                                                                                                                                            | —     |
| Lighthouse CI, built-site tests                             | —                                                                        | `lighthouserc.cjs`, `tests/dist.test.mjs`                                      | unit tests only                                                                                  | later: a dist test needs a built `dist/`, which here is a 20 h artifact                                                                                                               | —     |
| OAuth, Auth.md, A2A, ARD, commerce                          | —                                                                        | —                                                                              | —                                                                                                | **reject**: no auth, no agent, no commerce. Stub files would only game the score                                                                                                      | —     |

## Delivery: stacked PRs, cheapest tier first

1. **MCP fix**: commit the MCP work; build `/mcp-catalog.json` with a
   post-build script; keep dot-folders on the root Worker; add a production
   smoke test. Ships with a root-only deploy.
2. **Discovery**: API catalog, agent skills index, Link headers on every
   HTML response including `/`; robots.txt Content Signals and AI bot rules.
3. **Markdown negotiation** in the Worker (`AI.toMarkdown`, Cache API).
4. **RSS**: `/rss.xml` plus its content type.
5. **Tier 2 batch**: head meta, BreadcrumbList, WebSite/Organization,
   Article fields, RSS `<link>`, WebMCP script tag. Merge only right before a
   planned full build.
6. **DNS-AID** script for digest.law.

Expected scanner result after 1–4 deploy: `linkHeaders`, `markdownNegotiation`,
`contentSignals`, `apiCatalog`, `mcpServerCard`, `agentSkills` pass. That
moves digest.law from 3 to 9 of 16. `webMcp` follows with PR 5, and `dnsAid`
once the owner runs PR 6's script.

## Plan review

An adversarial review of this plan (pi, `zai/glm-5.3`, 2026-11-07) raised
seven points. What became of each:

| #   | Finding                                                                                                            | Disposition                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The plan describes the MCP fix as future work                                                                      | Accepted as framing: PR 1 is the fix; the production finding describes production until it is deployed                                                                                                          |
| 2   | A root-only deploy ships whatever `public/_headers` and `public/.well-known/` copies `dist/` holds                 | **Fixed in PR 1**: preflight refuses when any `public/` file (pagefind aside) is missing from or differs in `dist/`                                                                                             |
| 3   | A catalog written from a `dist/` newer than the live shards lists pages that 404                                   | Documented as a precondition in `docs/build-and-deploy.md`; the smoke test checks a search hit's page                                                                                                           |
| 4   | Past 25 MiB the catalog (or id map) is split into parts, and the Worker, which fetches it whole, would see nothing | **Fixed in PR 1**: preflight refuses a split id map or catalog (4.1 MB and 6.4 MB today)                                                                                                                        |
| 5   | `"/"` in `run_worker_first` costs a Worker invocation on the busiest URL; `_headers` could carry the Link          | Rejected: every shard page already goes through the Worker, and `/` must reach it for markdown negotiation                                                                                                      |
| 6   | Markdown negotiation is underspecified (binding, input, q-values, cache key, invalidation, fallback, rate limit)   | **Addressed in PR 3**: `ai` binding; Blob input; q-value parsing; cache key = path + HTML ETag; HTML fallback on every failure; its own `MARKDOWN_RATE_LIMITER` (AGENTS.md keeps `MCP_RATE_LIMITER` for `/mcp`) |
| 7   | `property="twitter:card"` is not a defect                                                                          | Accepted: dropped from PR 5                                                                                                                                                                                     |

PR 3 was checked against the real converter with a throwaway `wrangler dev`
probe (AI bindings always run remotely):

| Page                                       |    HTML | Markdown tokens | Conversion |
| ------------------------------------------ | ------: | --------------: | ---------: |
| `/evidence-law/proof-of-writings/`         |   57 KB |           9,236 |     203 ms |
| home page                                  |   50 KB |           2,430 |     101 ms |
| a retained opinion (largest under the cap) | 1.96 MB |         164,389 |     555 ms |

## Decisions for the owner

- Content Signals policy. The default chosen here is `search=yes,
  ai-input=yes, ai-train=yes`, consistent with CC BY 4.0. Change it in
  `src/pages/robots.txt.ts`.
- When to run the next full build, which PR 5 needs.
- DNS-AID needs a token with Zone → DNS → Edit on digest.law and DNSSEC
  enabled for the zone.
