# FOLIO and SKOS profile — from-scratch scheme — 2026-07-29

> **Document set:** [Runner proposals](2026-07-29-RUNNER_V3_PROPOSALS.md) ·
> [Architecture](2026-07-29-ARCHITECTURE_FOLIO_ALIGNED.md) ·
> [FOLIO/SKOS](2026-07-29-FOLIO_SKOS.md) ·
> [Research audit](2026-07-29-RESEARCH_METHOD_AUDIT.md) ·
> [Atomic plan](2026-07-29-TODO.md)
>
> **Scenario boundary:** no new digest articles or releases have been
> generated. The existing 137,139-row v3 issue ledger is candidate input and
> implementation evidence, not a lawyer-validated canonical registry.
>
> **Evidence snapshot:** runner
> `265a8610695067d825392751ffdb3e5932a0aefd`; site
> `3e49d34387d2d5ce20930cc158d01dc5c725b071`; measurement cutoff
> `2026-07-29T18:03:54Z`.
>
> **Verification:** re-verified against code on 2026-07-30 — see the
> [verification addendum](../2026-07-30-verification-addendum.md) for
> confirmations, corrections, and drift (the pinned site commit no longer
> resolves after a history squash).

## Scenario

This profile assumes that the new edition contains **no generated digest
articles and no accepted concepts**. It defines the semantic contract that must
be implemented before generation.

Statuses are atomic:

- **DONE** — the decision is closed or a reusable prototype is evidenced.
- **PENDING** — the new scheme has not passed the acceptance test.

There is no “partially compliant” status. Individual SKOS capabilities and
integrity conditions are tracked separately.

## Purpose

SKOS is the publication and exchange model for the controlled vocabulary.
FOLIO is an external OWL ontology and semantic coordinate, not an established
SKOS ConceptScheme. Neither one proves that a legal issue is correctly framed,
a digest is legally accurate, or an authority remains valid. Those are
editorial and citator-quality questions governed elsewhere.

The target is a reviewed SKOS concept scheme in which:

- concepts have stable opaque IRIs;
- labels and notes carry explicit language tags;
- hierarchy is editorial and may be polyhierarchical;
- associative relationships are first-class;
- external mappings state the correct mapping strength and version;
- concept identity is independent from the website route;
- invalid or incomplete records cannot enter a release; and
- every semantic assertion has provenance and editorial status in the
  canonical model.

## Current implementation evidence

Snapshot: **2026-07-29**.

| Finding                                                                     | Evidence                                                                                                                                                                                                         | Cause                                                                                                                                                     | Greenfield rule                                                                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Current concept IRIs are route-derived                                      | `digest-law-us/src/lib/skos.ts`: `conceptIri(slugPath)`                                                                                                                                                          | The site tree was reused as identity                                                                                                                      | Registry IRI uses opaque ID; routes are projections                                                    |
| Current page structure adds ontology                                        | `conceptFor()` adds the structural parent to `skos:broader`                                                                                                                                                      | Navigation and semantics were collapsed                                                                                                                   | Only reviewed relations enter SKOS                                                                     |
| Current human-readable literals are English                                 | `langLit()` hard-codes `en`                                                                                                                                                                                      | Single-language site assumption                                                                                                                           | Every natural-language literal stores its own BCP 47 tag                                               |
| Current mapping export omits `exactMatch` and `narrowMatch`                 | `conceptFor()` aggregates close, related, and broad only                                                                                                                                                         | Exporter was designed around present data, not the full mapping profile                                                                                   | Support the full governed mapping set                                                                  |
| Current ingest is permissive                                                | `src/content.config.ts` uses optional fields and `.passthrough()`                                                                                                                                                | Legacy display requirements                                                                                                                               | Canonical ingest is strict; the publisher consumes validated releases                                  |
| Current hierarchy is essentially a tree                                     | The publisher always derives a parent; the 2026-07-29 scan found no parsed concept with more than one explicit `broader`                                                                                         | Path-first generation                                                                                                                                     | Concepts and placements are separate                                                                   |
| Current semantic enrichment is uneven                                       | 1,705 digest paths; 660 dedicated non-empty `definition` values; 1,633 (95.8%) with either `definition` or legacy `description`; 668 scope notes; 159 with `related`; 135 with populated project legal relations | The publisher's legacy description fallback gives broad descriptive coverage, while dedicated semantic documentation and graph construction remain sparse | Definitions, scope, relationships, and mappings get explicit completeness gates                        |
| Current lexical/language data are uneven                                    | 523 measured digests have alternate labels; 348 have historical labels; zero carry explicit language metadata; the publisher exports `historical_labels` as `skos:hiddenLabel` (`digest-law-us/src/lib/skos.ts`) | Language is injected by the exporter and historical terms are not governed as label records; historical labels are conflated with search-only hidden labels | Store reviewed label kind, provenance, and BCP 47 tag in canonical data                                |
| Current FOLIO mappings are common but other mappings are absent in the scan | 1,620 measured digests had a FOLIO mapping group; no populated EuroVoc, SALI, or LIST mapping was observed                                                                                                       | FOLIO anchor propagation was automated; external crosswalks were not curated                                                                              | Mapping volume is never used as a quality proxy                                                        |
| v3 FOLIO coordinates mix external and local IDs                             | 104,572 real `R*` plus 32,567 local `x-digest-*` area values; all 137,139 objective values are `R*`                                                                                                              | Operational anchoring preceded mapping review                                                                                                             | Preserve coordinates as provenance; mint no SKOS mapping without target-type and semantic adjudication |

These findings do not invalidate the prototype. They show why the new scheme
must separate canonical semantics from filesystem publication.

## Normative entity separation

| Entity                                           | SKOS role                                                                          | Not represented as                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Legal topic or issue                             | `skos:Concept`                                                                     | A folder, Markdown file, or literal label                           |
| Stable jurisdictional vocabulary series          | `skos:ConceptScheme`                                                               | A dated website build or distribution                               |
| Immutable digest release                         | Versioned dataset/release resource with explicit concept membership                | A replacement identity for the stable scheme                        |
| Professional browse arrangement                  | `skos:Collection`, ordered collection, or a project placement model as appropriate | An unreviewed semantic parent                                       |
| Case, statute, regulation, treaty, or court rule | Authority entity in the authority graph                                            | A legal issue concept merely because its title appears in a heading |
| Digest article                                   | Document linked to the issue concept                                               | The concept itself                                                  |
| Historical heading occurrence                    | Provenanced warrant/item record                                                    | A preferred label by default                                        |
| FOLIO class                                      | External concept/ontology resource linked by a reviewed mapping                    | The local issue identifier                                          |

## Namespace and identity

### Decisions

| ID    | Status      | Decision                                                                                                                                        |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| S-001 | **DONE**    | Local concept IRIs are opaque and do not contain labels or paths.                                                                               |
| S-002 | **DONE**    | Concept IRI and document/page URL are distinct.                                                                                                 |
| S-003 | **DONE**    | A concept survives relabeling, reparenting, translation, mapping changes, and publication moves.                                                |
| S-004 | **PENDING** | Reserve and document the final namespace and persistence policy.                                                                                |
| S-005 | **PENDING** | Implement content negotiation and route resolution tests.                                                                                       |
| S-006 | **PENDING** | Implement tombstones, replacements, and redirects without reusing an IRI.                                                                       |
| S-007 | **PENDING** | Publish `https://w3id.org/digest-law/datatype/concept-id` and its lexical contract.                                                             |
| S-008 | **PENDING** | Require one canonical typed notation per released concept and notation uniqueness within each scheme; keep the registry ID in `dct:identifier`. |

Illustrative identifiers:

```text
Concept: https://w3id.org/digest-law/concept/01K...
Scheme:  https://w3id.org/digest-law/scheme/us
Page:    https://digest.law/en-us/us/contracts/consideration/adequacy/
Release: https://w3id.org/digest-law/release/us/2027.1
```

The stable scheme series and immutable release are different resources.
Concepts use `skos:inScheme` for the stable scheme; release membership is
recorded separately. The exact opaque-ID technology remains pending. The
invariant is not. W3ID supplies durable redirects; content negotiation,
tombstones, release resolution, and redirect tests remain project work.

## Label profile

### Required label properties

Every released concept has:

- at most one `skos:prefLabel` for each supported BCP 47 language tag, as
  required by the SKOS S14 integrity condition;
- zero or more `skos:altLabel` values for practitioner, statutory, historical,
  spelling, abbreviation, and controlled synonyms;
- zero or more `skos:hiddenLabel` values only for search aids that should not
  be displayed as accepted synonyms; and
- a provenance record for each label in the canonical registry.

All natural-language label literals have BCP 47 language tags. Audience,
jurisdiction, and usage preferences belong in the canonical project label
model or SKOS-XL extension; they do not authorize multiple same-language
`skos:prefLabel` values on one concept. Labels in different legal systems are
not translations merely because their surface forms align. Historical labels
are not automatically hidden labels; `skos:hiddenLabel` is reserved for search
aids that should not be displayed as accepted alternatives.

### Integrity rules

| ID    | Status      | Rule                                                                                                                        | Acceptance                                  |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| L-001 | **PENDING** | No more than one preferred label per concept per BCP 47 language tag                                                        | SHACL and application constraint pass       |
| L-002 | **PENDING** | Preferred, alternate, and hidden label values are pairwise disjoint for one concept/language                                | Negative fixtures fail release              |
| L-003 | **PENDING** | A preferred label is not blank, scaffolding, a citation-only string, or raw case caption unless the concept kind permits it | Editorial and deterministic validators pass |
| L-004 | **PENDING** | Historical/offensive labels remain discoverable without being displayed as current preferred labels                         | UI/export fixtures pass                     |
| L-005 | **PENDING** | Transliteration is labeled separately from translation                                                                      | Multiscript fixtures pass                   |
| L-006 | **PENDING** | Search normalization does not alter the canonical literal                                                                   | Round-trip tests pass                       |

## Documentation profile

Every released issue concept requires:

- `skos:definition` — what the issue is;
- `skos:scopeNote` — inclusion, exclusion, jurisdiction, time, and boundary
  guidance;
- at least one example or editorial note in the canonical registry when the
  issue is easily confused;
- `skos:historyNote` or project change record when a material scope/label
  change occurred; and
- a concept-kind value in the project application profile.

Definitions and scope notes are language-tagged. A generated digest paragraph
is not automatically a concept definition.

| ID    | Status      | Requirement                                                                          |
| ----- | ----------- | ------------------------------------------------------------------------------------ |
| N-001 | **PENDING** | 100% of public issue concepts have reviewed definitions.                             |
| N-002 | **PENDING** | 100% of public issue concepts have reviewed scope notes.                             |
| N-003 | **PENDING** | Scope notes distinguish adjacent topics and state jurisdiction/temporal limitations. |
| N-004 | **PENDING** | Documentation changes are versioned independently from concept identity.             |

## Hierarchy, collections, and legal relations

### Hierarchy

`skos:broader` means a reviewed semantic broader concept. It is not:

- the current folder parent;
- the first topic under which the model placed an item;
- a law-library menu heading copied without adjudication;
- a FOLIO area merely associated with the issue; or
- a convenience breadcrumb.

Multiple broader concepts are permitted. The canonical registry stores asserted
relations. The release may materialize inverse `skos:narrower` relations
deterministically.

### Collections and placements

Use project placements for navigational arrangements. Use SKOS collections only
when the grouping semantics fit SKOS and do not create misleading concept
hierarchy. Topic-entry menus, jurisdictional browsing, classroom sequences, and
objective/task views may have different placements over the same concepts.

### Associative and typed legal relations

`skos:related` expresses a symmetric associative relation when neither concept
is properly broader. The project may also maintain typed domain relations:

- `digest:defenseTo`;
- `digest:remedyFor`;
- `digest:procedureFor`;
- `digest:exceptionTo`;
- `digest:elementOf`;
- `digest:governedBy`;
- `digest:conflictsWith`; and
- `digest:distinguishedFrom`.

The ontology for typed relations needs domain, range, symmetry, inverse, and
inference review. Until completed, these relations are application data and do
not silently assert OWL consequences.

| ID    | Status      | Requirement                                                                                                    |
| ----- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| H-001 | **DONE**    | Polyhierarchy is allowed by design.                                                                            |
| H-002 | **DONE**    | Navigation placements and semantic hierarchy are separate.                                                     |
| H-003 | **PENDING** | Review every public broader relation and reject cycles in the selected hierarchy projection.                   |
| H-004 | **PENDING** | Require useful associative relations for cross-cutting issues where warranted; do not set a meaningless quota. |
| H-005 | **PENDING** | Define and test the project legal-relation vocabulary.                                                         |
| H-006 | **PENDING** | Validate inverse consistency and prohibit self-relations.                                                      |
| H-007 | **PENDING** | Publish hierarchy and relationship change diffs per release.                                                   |

## FOLIO mapping profile

### Architectural role

FOLIO—the Federated Open Legal Information Ontology—is a candidate external
semantic coordinate for legal-domain interoperability. A jurisdiction package
selects it only when the pinned version, license, target semantics, and local
use case justify the mapping. It is not the local registry, the browse tree,
the legal accuracy oracle, or the source of all issue granularity.

The official FOLIO artifact represents its R-identifiers as OWL classes rather
than documenting them as members of a SKOS ConceptScheme. The canonical
mapping record must therefore preserve the external RDF type. The exporter may
emit a `skos:*Match` triple only to a pinned SKOS proxy/view or under a
documented and reviewed OWL/SKOS dual-typing policy. Otherwise it emits a
project mapping assertion without implying that the FOLIO class is already a
`skos:Concept`.

### Mapping predicates

| Predicate           | Use                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `skos:exactMatch`   | High-confidence interchangeability across applications; symmetric and transitive; rare and requires strong review              |
| `skos:closeMatch`   | Sufficiently similar for interchangeable use in some information-retrieval applications; symmetric and not declared transitive |
| `skos:broadMatch`   | The external mapped concept is broader than the local concept                                                                  |
| `skos:narrowMatch`  | The external mapped concept is narrower than the local concept                                                                 |
| `skos:relatedMatch` | Meaningful association without hierarchical/equivalence claim                                                                  |

Area and objective anchors are not automatically equivalence mappings. A local
issue located under a FOLIO area is commonly narrower than or associated with
that area. A conditional or scope-qualified alignment remains a project
mapping assertion; prose qualifications do not weaken the semantics of a bare
`skos:exactMatch` triple.

### Required mapping assertion

```yaml
mapping_id: map_opaque
local_concept_id: concept_opaque
external_system: folio
external_iri: https://folio.openlegalstandard.org/R...
target_rdf_type: owl:Class
compatibility_policy: project_mapping_assertion
predicate: https://w3id.org/digest-law/vocab/mapsToFolioClass
external_version:
  repository: alea-institute/FOLIO
  commit: "<git-sha>"
  artifact_sha256: "<sha256>"
rationale: "<editorial explanation>"
method: human_reviewed_candidate
review:
  reviewer_id: "<id>"
  decided_at: "YYYY-MM-DD"
status: accepted
```

The canonical record is richer than any RDF triple. It records target type and
compatibility policy. The exporter emits a SKOS mapping triple only when that
policy permits it and publishes provenance separately.

### FOLIO atomic work

| ID    | Status      | Work                                                                                                                                                     |
| ----- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-001 | **DONE**    | FOLIO is the federation layer, not the operative taxonomy.                                                                                               |
| F-002 | **DONE**    | FOLIO snapshot pinning is required. Existing `build_issues_v3.py` and `folio_build_manifest.example.json` demonstrate the pattern.                       |
| F-003 | **PENDING** | Select and hash the FOLIO snapshot for the new scheme.                                                                                                   |
| F-004 | **PENDING** | Validate the FOLIO license and publish attribution for the selected snapshot.                                                                            |
| F-005 | **PENDING** | Build reviewed mapping candidates for the topic-entry layer.                                                                                             |
| F-006 | **PENDING** | Review relationship strength for each candidate.                                                                                                         |
| F-007 | **PENDING** | Detect conflicting, obsolete, and duplicate mapping assertions.                                                                                          |
| F-008 | **PENDING** | Test mapping preservation across local and external version changes.                                                                                     |
| F-009 | **PENDING** | Publish mapping coverage by concept kind, jurisdiction, relation, and review status.                                                                     |
| F-010 | **PENDING** | Inspect target RDF types and approve a SKOS proxy/view, dual-typing policy, or project-only assertion for each selected FOLIO release.                   |
| F-011 | **PENDING** | Round-trip all five SKOS mapping predicates, including the currently omitted `exactMatch` and `narrowMatch`, when the compatibility policy permits them. |

Coverage is descriptive. It must not be maximized by weakening mapping
semantics.

## Other external schemes

The architecture supports versioned mappings to library and legislative
vocabularies such as LCSH/LCC, EuroVoc, and jurisdiction-specific schemes.
Every source has its own semantics and license. The same mapping predicate
cannot be assigned merely because labels match.

| ID    | Status      | Work                                                              |
| ----- | ----------- | ----------------------------------------------------------------- |
| X-001 | **PENDING** | Select schemes based on target user and jurisdiction needs.       |
| X-002 | **PENDING** | Record version, license, mapping method, reviewer, and rationale. |
| X-003 | **PENDING** | Evaluate lexical candidate generation on a held-out reviewed set. |
| X-004 | **PENDING** | Publish unmatched concepts rather than forcing weak mappings.     |

## Multilingual profile

### Data requirements

- BCP 47 language tags on every human-readable literal;
- script-aware normalization;
- language-specific preferred and alternative labels;
- separate source language and publication/interface locale;
- local-language definitions and scope notes;
- directionality support;
- language-aware search analyzers;
- provenance for translations; and
- reviewer qualifications tied to legal system and language.

### Semantic safeguards

Translation does not establish concept equivalence. A jurisdiction may:

- share the same concept with localized labels;
- maintain a close or related local concept;
- maintain a narrower/broader concept;
- have no equivalent; or
- use a superficially identical word with materially different doctrine.

| ID    | Status      | Requirement                                                                      |
| ----- | ----------- | -------------------------------------------------------------------------------- |
| M-001 | **PENDING** | Replace site-wide hard-coded English literals with record-level language values. |
| M-002 | **PENDING** | Define preferred-label contexts for language and jurisdiction.                   |
| M-003 | **PENDING** | Add local-review workflow for translations and equivalence mappings.             |
| M-004 | **PENDING** | Validate right-to-left, multiscript, diacritic, collation, and search fixtures.  |
| M-005 | **PENDING** | Export multilingual SKOS without silent English fallback.                        |

## Digest and concept separation

The concept is the controlled-vocabulary entity. The digest is an editorial
document about that concept in a jurisdiction and time.

Recommended links:

- concept → digest document: `foaf:page` or a documented project property;
- digest → concept: schema.org `about` and/or Dublin Core subject;
- digest → authority: structured citation/claim links;
- concept → source warrant: provenance records, not `skos:exactMatch`;
- concept → stable concept scheme: `skos:inScheme`.

A new digest revision does not mint a new concept. A split gives its child
concepts new IDs. A merge follows an explicit policy: retain one designated
surviving identity or mint a new aggregate identity. Every retired IRI remains
resolvable with its disposition and replacement links.

## SKOS conformance profile

“Fully SKOS compliant” is not a useful single checkbox. This project will
publish an application profile and separately verify syntax, integrity
conditions, project constraints, and semantic/editorial quality.

### Required validators

| Validator                        | Status      | Scope                                                                                                                                                                                                                                     |
| -------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RDF syntax and JSON-LD expansion | **PENDING** | Every release format parses and expands                                                                                                                                                                                                   |
| SKOS integrity rules             | **PENDING** | Label disjointness; per-language preferred-label cardinality; `exactMatch` symmetric/transitive; `closeMatch` and `relatedMatch` symmetric; `closeMatch` not declared transitive; mapping disjointness; hierarchy/association constraints |
| SHACL shapes                     | **PENDING** | Project-required labels, notes, status, language, mappings, provenance                                                                                                                                                                    |
| IRI/link checker                 | **PENDING** | Canonical, external, page, redirect, and download links                                                                                                                                                                                   |
| Hierarchy checker                | **PENDING** | Self-relations, cycles in selected browse hierarchy, orphan policy                                                                                                                                                                        |
| Mapping checker                  | **PENDING** | External IRI, version, predicate, conflict, rationale, reviewer                                                                                                                                                                           |
| Language checker                 | **PENDING** | Valid BCP 47 tags and required language coverage                                                                                                                                                                                          |
| Release parity checker           | **PENDING** | Canonical store equals JSON-LD/RDF/UI projections                                                                                                                                                                                         |
| Editorial sampling               | **PENDING** | Semantic correctness beyond machine validation                                                                                                                                                                                            |

The validator distinguishes direct `skos:broader`/`skos:narrower` assertions
from their transitive closure, checks the documented inverse semantics, and
keeps `skos:related` disjoint from hierarchical transitive relations. An
acyclic validated hierarchy is an explicit project application constraint,
not a claim that every SKOS graph with a cycle is syntactically non-conformant.
Top concepts are reviewed assertions, not folder roots.

### Required release artifacts

- canonical structured release;
- JSON-LD;
- Turtle;
- N-Triples or another stream-friendly RDF format;
- SKOS concept-scheme metadata;
- SHACL shapes;
- mapping file with external-version provenance;
- human-readable change log;
- machine-readable diff;
- license and attribution files;
- checksum/signature manifest; and
- validation report.

## Illustrative output

The canonical store should produce RDF equivalent to:

```turtle
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix dl:   <https://w3id.org/digest-law/vocab/> .
@prefix idt:  <https://w3id.org/digest-law/datatype/> .

<https://w3id.org/digest-law/concept/01EXAMPLE>
    a skos:Concept ;
    skos:inScheme <https://w3id.org/digest-law/scheme/us> ;
    dct:isPartOf <https://w3id.org/digest-law/release/us/2027.1> ;
    skos:notation "01EXAMPLE"^^idt:concept-id ;
    skos:prefLabel "Adequacy of consideration"@en-US ;
    skos:altLabel "Sufficiency of consideration"@en-US ;
    skos:definition "A reviewed definition would appear here."@en-US ;
    skos:scopeNote "A reviewed inclusion and exclusion note would appear here."@en-US ;
    skos:broader <https://w3id.org/digest-law/concept/01CONTRACT> ;
    skos:related <https://w3id.org/digest-law/concept/01UNCONSCIONABILITY> ;
    dct:identifier "01EXAMPLE" ;
    dl:conceptKind "issue" .
```

The example is structural only. It does not establish the final label, scope,
relationship, or mapping.

## Required implementation sequence

1. **PENDING** — finalize the canonical schemas and namespace.
2. **PENDING** — publish the application profile and SHACL shapes.
3. **PENDING** — produce and validate an empty concept scheme release.
4. **PENDING** — adjudicate a small multilingual/multi-jurisdiction fixture
   set, including non-equivalence cases.
5. **PENDING** — implement identity/route separation in the publisher.
6. **PENDING** — implement full label, note, relation, and mapping exports.
7. **PENDING** — implement release parity and external-version checks.
8. **PENDING** — adjudicate the professional topic-entry layer.
9. **PENDING** — publish a reviewed pilot with its validation report.

## Good-to-have extensions

| ID    | Status      | Extension                             | Benefit                                                                   |
| ----- | ----------- | ------------------------------------- | ------------------------------------------------------------------------- |
| G-001 | **PENDING** | SKOS-XL labels                        | Supports richer label identity, provenance, and relationships when needed |
| G-002 | **PENDING** | PROV-O export                         | Standardizes assertion and release provenance                             |
| G-003 | **PENDING** | OntoLex-Lemon alignment               | Useful for advanced multilingual lexical modeling                         |
| G-004 | **PENDING** | Public SPARQL endpoint                | Enables research after operational controls mature                        |
| G-005 | **PENDING** | Federated mapping review              | Lets jurisdiction partners govern local mappings                          |
| G-006 | **PENDING** | Persistent mapping-diff subscriptions | Helps downstream systems track semantic change                            |

Do not adopt a richer standard merely to appear sophisticated. Add it only
when a concrete use case cannot be represented safely in the base profile.

## Completion condition

This profile is implemented only when:

1. every required validator is **DONE**;
2. the empty release and multilingual fixtures pass;
3. no semantic relation is inferred from a filesystem path;
4. no public concept lacks reviewed identity, labels, definition, scope, and
   jurisdiction;
5. FOLIO and other mappings include version and review provenance; and
6. an independent release consumer can resolve, parse, validate, and compare
   releases without access to the private research repository.

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
