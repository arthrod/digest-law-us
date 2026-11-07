---
name: american-legal-digest
description: Find, cite and read American Legal Digest topics on digest.law through its read-only MCP server, markdown pages, permanent concept IRIs and SKOS dump.
---

# American Legal Digest (digest.law)

Source-grounded digests of United States legal doctrine, one page per topic,
each with the retained sources, the searches that found them, and an audit
trail. Digests are a map of doctrine pointing at authorities, not legal
advice.

## Find a topic: MCP

`POST https://digest.law/mcp` is a stateless MCP server (Streamable HTTP,
JSON responses, no session). Server card:
`https://digest.law/.well-known/mcp/server-card.json`.

| Tool              | Use it to                                                                      |
| ----------------- | ------------------------------------------------------------------------------ |
| `search_concepts` | match words against topic labels and routes (`query`, `limit` ≤ 50)            |
| `list_concepts`   | browse one area by route prefix, e.g. `evidence-law` (`area`, `page`, `limit`) |
| `get_concept`     | resolve a 32-hex concept id or a route to its page and IRI                     |

Each result carries `url` (the page) and `iri` (the permanent identifier).
The catalog covers labels and routes, not the prose: read the page for the
digest itself. Limit: 60 requests per minute per IP.

## Cite a topic

- Cite the IRI, not the page URL: `https://w3id.org/digest-law/concept/{id}`.
  Routes can change when the taxonomy is corrected; ids never do.
- `https://digest.law/id/{id}` resolves an id to its current page (301 to a
  survivor when a duplicate was merged, 410 when a concept was retired).
- Every page embeds its SKOS concept and a schema.org `Article` as JSON-LD.
  The whole scheme is at `https://digest.law/skos.jsonld`.

## Read a page as markdown

Send `Accept: text/markdown` to any page URL and the page comes back as
markdown: YAML front matter (title, description), the digest with absolute
links, then the page's JSON-LD. `x-markdown-tokens` gives its size. Pages
over 2 MiB, and clients past 60 conversions a minute, get the HTML instead.

```bash
curl -H 'Accept: text/markdown' https://digest.law/evidence-law/proof-of-writings/
```

## Read the evidence

Under each topic: `…/sources/{slug}/` (each retained source in full),
`…/audit/` (what was kept and dropped, and why), `…/caselaw/` and
`…/statutory/` (tables of authorities). Every URL is in
`https://digest.law/sitemap-index.xml`.

## Terms

Digests and data: CC BY 4.0. Attribute as "American Legal Digest — United
States, https://w3id.org/digest-law/us/". Retained sources are public legal
materials.
