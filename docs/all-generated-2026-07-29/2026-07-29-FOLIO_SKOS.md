# FOLIO and SKOS Plan — All 137,139 Digests Generated — 2026-07-29

> **Document set:** [Runner proposals](2026-07-29-RUNNER_V3_PROPOSALS.md) ·
> [Architecture](2026-07-29-ARCHITECTURE_FOLIO_ALIGNED.md) ·
> [FOLIO/SKOS](2026-07-29-FOLIO_SKOS.md) ·
> [Research audit](2026-07-29-RESEARCH_METHOD_AUDIT.md) ·
> [Atomic plan](2026-07-29-TODO.md)
>
> **Evidence snapshot:** runner
> `265a8610695067d825392751ffdb3e5932a0aefd`; site
> `3e49d34387d2d5ce20930cc158d01dc5c725b071`; measurement cutoff
> `2026-07-29T18:03:54Z`.

## Scenario and claim boundary

This document assumes that all 137,139 canonical U.S. issue records have been
generated as current-format bundles. It defines how to convert that completed
heading and digest corpus into a governed SKOS concept scheme without treating
generated frontmatter—or the word “issue” in the input ledger—as validated
taxonomy.

The measured 2026-07-29 checkout has 1,705 digest files. Its field counts expose
the behavior of the current exporter and generator; they are not invented
counts for the assumed completed corpus.

Only **DONE** and **PENDING** are used as status values.

## What SKOS is doing here

SKOS is the exchange and publication model for the controlled vocabulary:

- concept identity;
- preferred, alternate, and hidden labels;
- definitions and scope notes;
- broader, narrower, and associative relationships;
- concept schemes and top concepts;
- mappings to external schemes.

SKOS does not prove:

- that a heading is a legal issue;
- that the digest text is legally correct;
- that a source supports a claim;
- that a FOLIO concept is equivalent;
- that a case remains good law.

Those require editorial policy, evidence, legal review, mapping review, and a
separate authority/treatment system.

## Current measured SKOS-shaped data

Fresh scan of the 1,705 digest files at runner commit
`265a8610695067d825392751ffdb3e5932a0aefd`:

| Field or relation                                       |          Measured present | Measured missing |
| ------------------------------------------------------- | ------------------------: | ---------------: |
| `type: legal_issue`                                     |                     1,704 |                1 |
| Non-empty `notation`                                    |                     1,704 |                1 |
| Non-empty `issue_id`                                    |                     1,561 |              144 |
| Non-empty `broader`                                     |                     1,704 |                1 |
| More than one explicit `broader`                        |                         0 |            1,705 |
| Non-empty explicit `narrower`                           |                         1 |            1,704 |
| Non-empty `related`                                     | 159 concepts / 264 values |   1,546 concepts |
| Non-empty legal relations                               | 135 concepts / 268 values |   1,570 concepts |
| Non-empty dedicated `definition`                        |               660 (38.7%) |            1,045 |
| Dedicated `definition` or legacy `description` fallback |             1,633 (95.8%) |               72 |
| Non-empty scope note                                    |               668 (39.2%) |            1,037 |
| Non-empty alternate labels                              |                       523 |            1,182 |
| Non-empty historical labels                             |                       348 |            1,357 |
| Explicit language metadata                              |                         0 |            1,705 |
| Populated FOLIO anchor group                            |                     1,620 |               85 |
| Populated West 1914 mapping group                       |                         8 |            1,697 |
| Populated SALI/LMSS mapping group                       |                         0 |            1,705 |
| Populated LIST mapping group                            |                         0 |            1,705 |
| Populated EuroVoc mapping group                         |                         0 |            1,705 |

Atomic implementation accounting:

| ID   | State   | Atomic capability or gap                                                   |
| ---- | ------- | -------------------------------------------------------------------------- |
| M-01 | DONE    | Current writer and publisher carry and emit populated SKOS-shaped fields.  |
| M-02 | PENDING | Repair the one missing concept type.                                       |
| M-03 | PENDING | Repair the one missing notation.                                           |
| M-04 | PENDING | Resolve 144 missing issue IDs without inferring identity from label alone. |
| M-05 | PENDING | Resolve the one missing broader/explicit-root disposition.                 |
| M-06 | PENDING | Resolve 85 missing FOLIO anchor groups or record intentional absence.      |
| M-07 | PENDING | Adjudicate every populated relation.                                       |
| M-08 | PENDING | Adjudicate every populated definition and scope note.                      |
| M-09 | PENDING | Adjudicate every populated external anchor/mapping candidate.              |
| M-10 | PENDING | Complete dedicated definitions for validated concepts.                     |
| M-11 | PENDING | Complete scope notes for validated concepts.                               |
| M-12 | PENDING | Complete reviewed language-keyed labels.                                   |
| M-13 | PENDING | Curate polyhierarchy.                                                      |
| M-14 | PENDING | Curate associative relations.                                              |
| M-15 | PENDING | Curate and govern typed legal relations.                                   |
| M-16 | PENDING | Complete reviewed mappings required by the release profile.                |

Presence is not specialist approval. In particular, the FOLIO values are
operational anchors propagated from the v3 ledger, not validated SKOS mapping
assertions.

The v3 ledger makes that distinction measurable: 104,572 issue records use a
real FOLIO `R*` area identifier, 32,567 use a local `x-digest-*` area
identifier, and all 137,139 objective anchors use `R*` identifiers. These are
operational coordinates. They do not establish coextensive concept scope.

## Implemented foundation

### DONE

1. `key_digest/skos_okf.py` renders a consistent SKOS-shaped frontmatter block.
2. Required top-level fields are checked before the main digest is written.
3. FOLIO R-identifiers are expanded to FOLIO IRIs.
4. Local `x-digest:` placeholders are kept distinct from HTTP IRIs.
5. The public site emits `skos:Concept`, `skos:ConceptScheme`, labels, notes,
   hierarchy, associative links, and mapping properties in JSON-LD.
6. Unpublished relation targets are preserved in graph output rather than
   dropped.
7. W3ID provides a hosting-independent redirect namespace.
8. The local canonical issue record retains a UUID independent of its label.

These choices are worth preserving. The pending work is to make the UUID the
public identity, validate the assertions, and complete the vocabulary.

## Required corrections

### S-01 — Mint the concept IRI from stable identity

**State: PENDING**

**Problem.** Public identity changes when the path changes.

**Evidence.**

- Runner notation and URN derive from the complete path:
  `key_digest/skos_okf.py:40-60,140-151`.
- The site IRI is `W3ID_BASE + slugPath`:
  `digest-law-us/src/lib/skos.ts:22-24`.

**Cause.** The first publication architecture reused the readable browse path
as an identifier.

**Correction.**

- Mint `https://w3id.org/digest-law/concept/{opaque-public-id}` so identity is
  not coupled to one jurisdictional route.
- Treat `/{area}/.../{topic}/` as an edition route and alias.
- Publish path history, replacement, and deprecation records.
- Use public identity IRIs in every RDF relation.
- Configure W3ID redirects for concept, scheme, release, and legacy-route
  namespaces. W3ID persistence does not itself implement content negotiation,
  tombstones, or a version policy.

**Acceptance criteria.**

- Rename and reparent tests leave `@id` unchanged.
- All generated legacy routes resolve permanently.
- No relation target is reconstructed from text.
- Publish the `https://w3id.org/digest-law/datatype/concept-id` datatype;
  validate notation lexical form; require one canonical typed notation per
  released concept; and enforce notation uniqueness within each scheme.
- Keep the registry UUID/ID in `dct:identifier` rather than using an untyped
  notation as the identity source.

### S-02 — Stop forcing the folder parent to be an ontological parent

**State: PENDING**

**Problem.** The exporter adds the structural folder parent to `skos:broader`
even if frontmatter has a different or additional reviewed parent.

**Evidence.** `digest-law-us/src/lib/skos.ts:74-83`.

**Cause.** The filesystem was used as the graph source of truth to guarantee a
navigable tree.

**Correction.**

- Store reviewed relation assertions in the concept registry.
- Store a separate `primary_browse_parent` for navigation.
- Export SKOS hierarchy from graph assertions.
- Preserve the generated path as provenance and an edition placement.

**Acceptance criteria.**

- A concept can have zero, one, or multiple broader concepts according to
  policy.
- Navigation can choose a primary path without adding an RDF assertion.
- Hierarchical cycles fail the release.

### S-03 — Type the conceptual resources

**State: PENDING**

**Problem.** Almost every generated main file asserts `legal_issue`, although
the source material includes topics, doctrines, statutory regimes, authorities,
controversies, and organizational scaffolding.

**Evidence.** The measured snapshot has 1,704 `legal_issue` records and one
legacy `digest` record. There is no concept-kind field with the distinctions
above.

**Cause.** The generation contract used one file type for every research unit.

**Correction.**

- Adjudicate `topic`, `issue`, `doctrine_or_test`, `statutory_regime`,
  `authority`, `controversy_collection`, and `scaffold`.
- Publish topics, issues, doctrines, and selected regimes as SKOS concepts.
- Link authorities through the authority graph.
- Prevent scaffolds from being validated issue concepts.

**Acceptance criteria.**

- All 137,139 assumed records receive an adjudicated kind or remain
  `candidate`.
- No `scaffold` is represented publicly as a validated legal issue.
- Kind changes are versioned and do not change identity.

### S-04 — Complete labels and documentation by language

**State: PENDING**

**Problem.** Dedicated definitions and scope notes are absent on most measured
concepts, and the exporter hardcodes English. Legacy `description` gives the
site display text for most records, but it is not necessarily an
editorially scoped concept definition.

**Evidence.**

- 660 of 1,705 measured digests have a dedicated `definition`; 1,633 have
  either that field or a legacy `description` fallback.
- 668 have scope notes.
- `langLit()` always emits `@language: "en"`:
  `digest-law-us/src/lib/skos.ts:30-32`.

**Cause.** Semantic documentation was model-authored when available and empty
scaffolding was accepted. Language was treated as a site constant.

**Correction.**

- Store labels and notes as language-keyed editorial records.
- Enforce SKOS S14: a resource has no more than one `skos:prefLabel` for each
  BCP 47 language tag.
- Require a definition and scope note before `validated` status.
- Record negative scope (`do_not_use_for`) as structured usage notes.
- Add historical/offensive-label policy and provenance. A historical label is
  not automatically a `skos:hiddenLabel`; hidden labels are search aids that
  should not be displayed as ordinary alternatives.

**Acceptance criteria.**

- Every validated concept has a non-circular definition and operational scope
  note in its jurisdiction package's principal language.
- The one-preferred-label-per-language rule is checked per concept/resource;
  project-wide label collision reports remain a separate editorial check.
- Language tags are data-driven.
- Preferred, alternate, and hidden label values are pairwise disjoint for the
  same concept/language after normalization.

### S-05 — Curate polyhierarchy and associative relationships

**State: PENDING**

**Problem.** The present vocabulary behaves as a sparse tree, not a mature
legal thesaurus.

**Evidence.**

- Zero measured concepts have multiple broader values.
- Only 159 have `related`.
- The runner defaults `narrower` and `related` to empty:
  `key_digest/skos_okf.py:179-194`.

**Cause.** Prefix expansion created navigation, while no funded relation
curation stage followed.

**Correction.**

- Add valid alternate placements without cloning concepts.
- Curate conservative associative links with written relation policy.
- Derive `narrower` from approved inverse `broader`; do not independently edit
  both directions.
- Add typed legal-domain relations in a separate extension namespace, with
  SKOS relationships retained for broad interoperability.

**Acceptance criteria.**

- Reciprocal and cycle constraints pass.
- Every relation has provenance, editorial status, and release validity.
- Relationship usefulness passes a lawyer/librarian navigation evaluation.

### S-06 — Correct FOLIO mapping semantics

**State: PENDING**

**Problem.** Area and Objective anchors are both emitted as `skos:closeMatch`.
An issue is not necessarily near-equivalent to its practice area or objective.
The pinned FOLIO artifact also models its R-identifiers as OWL classes, not as
a documented SKOS ConceptScheme. A direct `skos:*Match` assertion therefore
implies a SKOS-concept interpretation that the present profile has not
justified.

**Evidence.** `key_digest/skos_okf.py:99-114` loops over both fields and puts
real R-ids into the same `closeMatch` list.

**Cause.** Operational federation anchors were converted directly into SKOS
mapping properties without a separate editorial mapping decision.

**Correction.**

- Preserve raw FOLIO anchors as provenance/facet coordinates.
- Create reviewed mapping assertions independently.
- Inspect and pin the FOLIO graph and license used by each release.
- Emit SKOS mapping properties only to a pinned SKOS proxy/view of FOLIO, or
  under an explicit, reviewed OWL/SKOS dual-typing policy.
- Otherwise publish a project mapping assertion that targets the FOLIO class
  without presenting it as a SKOS mapping.
- Where SKOS mappings are justified, use `exactMatch` only under a strict
  identity policy and choose close, broad, narrow, or related match according
  to concept scope.
- Record target FOLIO snapshot, reviewer, rationale, and confidence.

**Acceptance criteria.**

- No generated anchor becomes a SKOS mapping without adjudication.
- Every emitted SKOS mapping documents why the FOLIO target is validly treated
  as a `skos:Concept`.
- Every mapping names the FOLIO commit and ontology hash.
- A test set of broad-versus-close mappings reaches at least 0.85
  inter-reviewer agreement before scale-up.

### S-06A — Complete mapping-predicate export

**State: PENDING**

**Problem.** `digest-law-us/src/lib/skos.ts` exports close, related, and broad
mapping groups but omits `skos:exactMatch` and `skos:narrowMatch`.

**Cause.** The exporter was written around fields populated in the prototype
rather than a complete governed mapping profile.

**Correction.** Implement all five SKOS mapping predicates, validate their
direction, and round-trip canonical mapping assertions through JSON-LD, Turtle,
bulk data, and the API.

**Acceptance criteria.** Positive and negative fixtures prove exact, close,
broad, narrow, and related mapping parity without silently weakening or
reversing a predicate.

### S-07 — Produce the missing build manifest

**State: PENDING**

**Problem.** The repository contains `folio_build_manifest.example.json`, but
not the actual manifest that pins the FOLIO snapshot used for the derivative
file.

**Evidence.** Repository filesystem inspection on 2026-07-29.

**Cause.** `build_issues_v3.py --manifest` is optional and the existing
`issues_v3.jsonl` was committed without the generated artifact.

**Correction.**

- Recover or explicitly declare the source digest and FOLIO snapshot.
- Rebuild from the archived item-level input where possible.
- Make manifest output mandatory for all future builds.
- Sign release manifests.

**Acceptance criteria.**

- Manifest includes source hash, item/issue counts, FOLIO repository commit,
  ontology hash, code commit, configuration, timestamp, and output hash.
- Rebuilding reproduces 137,139 issue identities and 156,802 memberships.
- Missing pins fail the build.

### S-08 — Retain the authoritative concordance

**State: PENDING**

**Problem.** `issues_v3.jsonl` intentionally compresses full item-level mapping
and dedup provenance, but the authoritative input is not vendored with the
operational derivative.

**Evidence.** `key_digest/build_issues_v3.py:18-50` says complete mapping records
remain in the full item-level data; only the 76 MB derivative is present.

**Cause.** GitHub file-size constraints and runner efficiency favored the slim
file without a formal archival release channel.

**Correction.**

- Publish a content-addressed archival concordance outside ordinary Git.
- Retain every item-to-concept membership, merge decision, source path, label,
  and mapping record.
- Provide a queryable public derivative subject to source rights.

**Acceptance criteria.**

- Every concept resolves to all contributing item IDs.
- Every merge can be reviewed and reversed in a later edition.
- No source occurrence disappears merely because concepts were deduplicated.

### S-09 — Validate SKOS and project constraints

**State: PENDING**

**Problem.** Frontmatter verification checks only a small set of scalar keys;
the Astro schema is deliberately loose and passthrough.

**Evidence.**

- `verify_legal_issue_frontmatter()` parses simple top-level scalars:
  `key_digest/skos_okf.py:249-290`.
- `digest-law-us/src/content.config.ts:11-49` makes key identity fields optional
  and accepts arbitrary extra fields.

**Cause.** Compatibility with legacy records, including 69 measured bundles
without `run.json`, took priority over a strict release schema.

**Correction.**

- Define a strict versioned JSON Schema for authoring data.
- Export RDF and run SHACL shapes over concepts, labels, notes, relations,
  mappings, identity, dates, and deprecations.
- Add SKOS integrity-condition checks, dangling-target checks, duplicate IRI
  checks, and language-label checks.
- Check the SKOS semantics explicitly: `exactMatch` is symmetric and
  transitive; `closeMatch` and `relatedMatch` are symmetric; `closeMatch` is
  not declared transitive; broad/narrow relations are inverses; direct
  hierarchy is distinct from its transitive closure; exact mapping is disjoint
  from broad, narrow, and related mapping; and associative relations remain
  disjoint from hierarchical transitive relations.
- Enforce acyclic validated hierarchy as a project application constraint, not
  as a claim that SKOS generically forbids every hierarchy cycle.
- Require reviewed top-concept assertions; do not infer top concepts merely
  because a folder lacks a parent.
- Validate legacy records through a migration adapter rather than weakening the
  current schema.

**Acceptance criteria.**

- Zero release-blocking schema, SHACL, or graph-integrity violations.
- Every exception is explicit, time-limited, and tied to a migration record.
- Malformed mapping IRIs and unknown relation predicates fail closed.

### S-10 — Separate scheme, edition, and collection semantics

**State: PENDING**

**Problem.** Current frontmatter uses `scheme: "Open Legal Issue Taxonomy"`,
while the public concept scheme is the American Legal Digest U.S. namespace.
Topic-entry groupings, generated paths, and canonical issue membership are not
modeled separately.

**Evidence.**

- Scheme constant: `key_digest/skos_okf.py:19-23`.
- Public scheme node: `digest-law-us/src/lib/skos.ts:199-210`.

**Cause.** The taxonomy project and digest publication project evolved together
without a release registry for schemes and collections.

**Correction.**

- Assign a stable scheme-series IRI such as
  `https://w3id.org/digest-law/scheme/us`.
- Assign each immutable release a distinct IRI such as
  `https://w3id.org/digest-law/release/us/2027.1`.
- Keep `skos:inScheme` pointed at the stable scheme series and record release
  membership separately; do not silently turn each distribution release into a
  different concept scheme.
- Use `skos:Collection` only for meaningful groupings, not to conceal hierarchy.
- Represent edition placements separately from canonical semantic relations.
- Map the digest scheme to the broader OLIT project where appropriate.

**Acceptance criteria.**

- Every concept has one or more explicit scheme memberships.
- Scheme identity is consistent across frontmatter, RDF, API, and release
  manifest.
- Collections and hierarchical relations are not conflated.

## Target RDF pattern

The following is illustrative; identifiers and predicates must be frozen in the
versioned schema before migration:

```turtle
@prefix digest: <https://w3id.org/digest-law/concept/> .
@prefix scheme: <https://w3id.org/digest-law/scheme/> .
@prefix idtype: <https://w3id.org/digest-law/datatype/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .

digest:2b8aeb0b991956b48c8ea83e131707a5
    a skos:Concept ;
    skos:inScheme scheme:us ;
    dct:isPartOf <https://w3id.org/digest-law/release/us/2027.1> ;
    skos:notation "2b8aeb0b991956b48c8ea83e131707a5"^^idtype:concept-id ;
    skos:prefLabel "Log books as evidence"@en ;
    skos:definition "A recurring evidentiary issue concerning ..."@en ;
    skos:scopeNote "Use for questions about ..."@en ;
    skos:broader digest:parent-id ;
    skos:related digest:related-id ;
    dct:identifier "2b8aeb0b-9919-56b4-8c8e-a83e131707a5" ;
    prov:wasDerivedFrom <urn:digest-generation:...> .
```

A FOLIO mapping is added only after review:

```turtle
digest:2b8aeb0b991956b48c8ea83e131707a5
    <https://w3id.org/digest-law/vocab/mapsToFolioClass>
        <https://folio.openlegalstandard.org/R...> .
```

The project-specific assertion above preserves the target's OWL-class
semantics. It becomes `skos:broadMatch`, `skos:narrowMatch`, `skos:closeMatch`,
or `skos:exactMatch` only when the pinned target is exposed through an approved
SKOS proxy/view or an explicit reviewed dual-typing policy.

## Multilingual and cross-jurisdiction design

### Required

| Work                                               | State   | Acceptance                                                     |
| -------------------------------------------------- | ------- | -------------------------------------------------------------- |
| Language-keyed labels and notes                    | PENDING | No hardcoded exporter language                                 |
| Jurisdiction-specific concept schemes              | PENDING | Local law is not asserted as universal                         |
| Mapping layer between jurisdiction schemes         | PENDING | Relation semantics and reviewers recorded                      |
| Local authority-source policy                      | PENDING | Each package recognizes its own official sources and versions  |
| Local specialist editorial board                   | PENDING | Definitions and mappings approved by competent local reviewers |
| Unicode, tokenization, collation, and search tests | PENDING | Native-language queries retrieve the intended issues           |

Translation alone is insufficient. A translated U.S. issue may have no local
equivalent, may have broader or narrower scope, or may require a new concept.
Use `skos:exactMatch` only when the concepts are genuinely coextensive.

### Good to have

| Work                                 | State   | Benefit                                             |
| ------------------------------------ | ------- | --------------------------------------------------- |
| Cross-language lexical suggestions   | PENDING | Speeds synonym discovery while keeping review human |
| Multilingual embedding index         | PENDING | Improves discovery across labels and notes          |
| Shared global topic-entry collection | PENDING | Provides access without forcing doctrinal identity  |
| Translation-memory provenance        | PENDING | Makes terminology choices reproducible              |

## Brownfield conversion sequence

| Sequence                   | State   | Output                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------- |
| 1. Freeze generated corpus | PENDING | Signed immutable release                                            |
| 2. Import UUID identities  | PENDING | Stable concept registry                                             |
| 3. Preserve legacy paths   | PENDING | Alias and deprecation table                                         |
| 4. Type concepts           | PENDING | Issue/topic/doctrine/regime/authority/collection/scaffold decisions |
| 5. Curate labels and notes | PENDING | Language-tagged authority records                                   |
| 6. Build relation graph    | PENDING | Polyhierarchy and associative links                                 |
| 7. Review mappings         | PENDING | Snapshot-pinned external mapping assertions                         |
| 8. Validate                | PENDING | Schema, SHACL, SKOS, and project-policy report                      |
| 9. Publish                 | PENDING | Version-consistent HTML, API, RDF, and search release               |

## Quality bar for calling the scheme production-grade

All of the following remain **PENDING**:

- 100% stable opaque IRIs.
- 100% concept-kind decisions for validated concepts.
- 100% validated concepts with principal-language definition and scope note.
- Zero scaffold records published as validated issues.
- Zero dangling or cyclic hierarchical relations.
- Zero unpinned external mappings.
- Zero inferred `closeMatch` assertions from unreviewed operational anchors.
- Zero hardcoded-language RDF literals.
- Zero release-blocking SHACL or SKOS integrity failures.
- Published precision and inter-reviewer-agreement results for mapping and
  hierarchy decisions.

## Related all-generated documents

- [Runner proposals](2026-07-29-RUNNER_V3_PROPOSALS.md)
- [Architecture](2026-07-29-ARCHITECTURE_FOLIO_ALIGNED.md)
- [Research method audit](2026-07-29-RESEARCH_METHOD_AUDIT.md)
- [Atomic TODO](2026-07-29-TODO.md)

## Primary standards and implementation references

- W3C, [SKOS Simple Knowledge Organization System Reference](https://www.w3.org/TR/skos-reference/)
- W3C, [SKOS Primer](https://www.w3.org/TR/skos-primer/)
- W3C, [Shapes Constraint Language (SHACL)](https://www.w3.org/TR/shacl/)
- W3C, [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
- W3C, [PROV-O](https://www.w3.org/TR/prov-o/)
- IETF, [BCP 47: Tags for Identifying Languages](https://www.rfc-editor.org/info/bcp47)
- [W3ID permanent identifiers](https://w3id.org/)
- ALEA Institute,
  [FOLIO repository, license, data, and notices](https://github.com/alea-institute/FOLIO)
