# w3id.org/digest-law — redirect configuration

`digest-law/.htaccess` is the redirect configuration for the project's
permanent namespace. It is **not deployed from this repository**: w3id.org is
a community-run redirect service, so the file has to be submitted upstream.

Until that pull request merges, every `https://w3id.org/digest-law/…` IRI the
site publishes is a **stable name that does not dereference**. That is a
legitimate state for an identifier — resolution and identity are different
things — but it must not be described as if resolution already worked
(P1-014G / R7-024).

## Submitting

1. Fork <https://github.com/perma-id/w3id.org>.
2. Copy `digest-law/` (this directory's `.htaccess`) to the repository root as
   `digest-law/.htaccess`.
3. Open a PR. w3id asks for a short statement of who maintains the namespace
   and a commitment to keep it resolving; both belong in the PR body.
4. After merge, run the checks below against the live service.

## What must be true before each rule is enabled

| Rule                  | Depends on                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `concept/{id}`        | `/id/{id}` resolver on digest.law — implemented in `worker/index.ts`, needs `/id/*` in `run_worker_first` (wrangler.jsonc) and `/id-map.json` in the build |
| `us/{path}`           | the route existing on the site; these are the pre-registry IRIs, published per concept as `digest:legacyIri`                                               |
| `us/`, `scheme/us`    | `/skos.jsonld`                                                                                                                                             |
| `vocab/`, `datatype/` | `public/profile/digest-vocab.ttl`                                                                                                                          |
| `shapes/`             | `public/profile/digest-skos-shapes.ttl`                                                                                                                    |

## Why 302 and not 301

The w3id URI _is_ the identifier. A permanent redirect tells clients to record
`digest.law` and forget the w3id form — which defeats a hosting-independent
namespace. Where an identifier is gone rather than moved, the resolver answers
`410 Gone` at the target, so the distinction between "moved" and "retired"
survives the redirect.

## Verifying after merge

```sh
# a concept resolves to its current route
curl -sI https://w3id.org/digest-law/concept/<id> | head -3
curl -sIL https://w3id.org/digest-law/concept/<id> | grep -E '^(HTTP|location)'

# a retired concept reports 410, not 404
curl -sIL https://w3id.org/digest-law/concept/<retired-id> | grep '^HTTP'

# a legacy route IRI still lands on the page it always denoted
curl -sIL https://w3id.org/digest-law/us/evidence-law/proof-of-writings/ | grep -E '^(HTTP|location)'

# vocabulary and shapes dereference to Turtle
curl -sL https://w3id.org/digest-law/vocab/ | head -5
curl -sL https://w3id.org/digest-law/shapes/ | head -5
```

## Not implemented

- **Content negotiation.** There is no per-concept JSON-LD endpoint, so an
  `Accept`-driven branch would have nothing honest to point at; the whole
  graph is at `/skos.jsonld`. Adding per-concept representations is the
  prerequisite, not more rewrite rules.
- **Release resolution.** `release/{version}` IRIs are unallocated — stable
  scheme identity has not yet been separated from immutable release identity
  (P1-014A / R7-017).
- **Verification.** The checks above have never been run: the namespace does
  not exist upstream yet.
