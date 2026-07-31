# Ledger — American Legal Digest

The live tracker. One file, ordered by the
[bottleneck decisions of 2026-07-30](2026-07-30-bottleneck-decisions.md)
(D1–D4), consolidating the two 2026-07-29 plan sets.

**Precedence.** On _what happens next_, this file governs. On _what was
measured_, the plan documents govern — they are dated snapshots and are not
edited to match later reality (verification-addendum protocol rule 2). Every
row of both plans appears in [the complete inventory](#complete-inventory)
below; nothing was dropped in consolidation.

- Brownfield plan: [atomic implementation plan](all-generated-2026-07-29/2026-07-29-TODO.md) (P0/P1)
- Greenfield plan: [implementation ledger](from-scratch-2026-07-29/2026-07-29-TODO.md) (R0–R10, G)
- Findings behind them: [research audit](all-generated-2026-07-29/2026-07-29-RESEARCH_METHOD_AUDIT.md),
  [FOLIO/SKOS](all-generated-2026-07-29/2026-07-29-FOLIO_SKOS.md),
  [verification addendum](2026-07-30-verification-addendum.md)

**Owners.** `runner` = private `key-digest-runner`. `site` = this repo.
`editorial` = a decision or review act, not code.

**Statuses.** PENDING · IN PROGRESS · PARTIAL · DONE · BROKEN (a gate that
does not do what its name says) · REGRESSED (green for the wrong reason) ·
BLOCKED · RISK-ACCEPTED.

## State of play — 2026-07-31

Measured today, not inherited from the plan documents:

| Fact                                                  | Value                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Corpus concepts (directories)                         | 4,569                                                                              |
| Digest markdown files                                 | 1,811                                                                              |
| Digests carrying a corpus `issue_id`                  | 1,641 (170 without)                                                                |
| Digests carrying one frontmatter `broader`            | 1,787 (24 none; 3 differ from folder parent)                                       |
| Digests carrying any language field                   | 0                                                                                  |
| Digests with historical labels / alt labels / related | 293 / 372 / 161                                                                    |
| Public concept ids minted and committed               | 4,569 (0 unminted, 0 integrity violations)                                         |
| Site unit tests                                       | 28 passing (`bun test src`)                                                        |
| `bun run lint`                                        | exit 0 — warnings only; `console.warn` still at `src/lib/corpus.ts:88`             |
| `bun run format:check`                                | **exit 2 — matches zero files**; CI runs this                                      |
| `bun run check`                                       | exit 2 (style warnings); no type check is wired to any gate                        |
| `bunx tsc --noEmit` (run manually)                    | 3 errors, all pre-existing: `src/lib/corpus.ts:140,143`, `src/scripts/theme.ts:19` |

Two of these deserve to be said plainly:

1. **The format gate is inert, not passing.** `oxfmt --check .` reports
   "Expected at least one target file. All matched files may have been excluded
   by ignore rules" — the `.prettierignore` `/*`-plus-negation pattern is not
   honoured by oxfmt. `.github/workflows/ci.yml` runs it, so CI is red and has
   not been checking formatting at all. Exactly the failure mode protocol
   rule 4 names.
2. **No release claim is available.** D3 stands: with one reviewer, who is also
   the pipeline's author, every `validated`-channel gate (gold set, dual
   review, κ ≥ 0.80, zero-critical-error release samples) remains blocked.

## Execution order

Per D1–D4. Stages run in this order; work inside a stage may parallelise.

### Stage 1 — Freeze and inventory (D1 step 1, P-1)

| ID              | Work                                                                                           | Owner  | Status                       |
| --------------- | ---------------------------------------------------------------------------------------------- | ------ | ---------------------------- |
| P0-001          | Freeze the current generated tree as an immutable evidence release, at its actual current size | runner | PENDING — **blocks Stage 2** |
| P0-005 / P0-006 | `run.json` frozen as generation provenance; inventories cover actual disk state                | runner | PENDING                      |
| P0-002 / P0-004 | Bind every bundle to one canonical issue ID; reconstruct edition source associations           | runner | PENDING                      |

Content-addressed inventory of the tree is the deliverable, not a tag: the
site evidence pin `3e49d343…` already stopped resolving once history was
squashed, so record tree hashes and archive the measurement scripts.

### Stage 2 — Runner blocking patches, then generation into quarantine (D2)

| ID                       | Work                                                                                                                                                                                                               | Owner  | Status  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------- |
| P0-003 / R3-007 / R3-008 | RetainedSource identity: one immutable record per source through save/classify. Fixes **both** defects — the positional join after rejection _and_ the `source_markdown` vs `source_documents` collection mismatch | runner | PENDING |
| R3-009                   | Property tests: random drop/reorder/dedupe preserves bindings                                                                                                                                                      | runner | PENDING |
| P0-005 / P0-006          | Manifest integrity (P-3)                                                                                                                                                                                           | runner | PENDING |
| P-4                      | Stage-regression remediation — restore honesty/consistency behaviour lost between stage 2 (5.3/5.8/5.1/5.2) and current (3.4/5.2/4.4/4.1)                                                                          | runner | PENDING |
| P0-007                   | `RUNNER_VERSION` 0.4.0 vs shipped image 0.4.17                                                                                                                                                                     | runner | PENDING |
| P0-011                   | Stop regeneration overwriting reviewed editions                                                                                                                                                                    | runner | PENDING |

Continuation condition: all output lands in a `generated`/`candidate` channel
and cannot reach `reviewed`/`validated` without the Stage 4 gates.

### Stage 3 — Governance and canonical contracts (D1 step 2)

R0-001…R0-010 (governance, stop rules, claims vocabulary) and R1-001…R1-020
(schemas, identity, rights, ledger). See the inventory. Two rows moved today:

| ID              | Work                                               | Owner       | Status                                                                                                                                        |
| --------------- | -------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R1-016 / P1-001 | Opaque-ID algorithm and minted public concept IRIs | site+runner | **DONE** — allocated at generation, carried across regeneration, adopted by the site registry ([design note](2026-07-31-concept-identity.md)) |
| R1-018 / P1-002 | Route registry with append-only key history        | site        | **PARTIAL** — keys and legacy IRIs published; w3id redirects (P1-014G) pending                                                                |

### Stage 4 — Triage harness and founder-labelled audit stream (D3)

| ID                            | Work                                                                      | Owner     | Status                                                      |
| ----------------------------- | ------------------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| P0-013                        | Quarantine unsupported claims                                             | runner    | PENDING                                                     |
| P1-015…P1-020 / R6-001…R6-006 | Editorial statuses, rubrics, review workspace, error taxonomy, stop rules | editorial | PENDING                                                     |
| R6-007                        | Reviewer independence — self-approval blocked                             | editorial | PENDING                                                     |
| P0-014 / R6-008…R6-018        | Gold set, dual review, agreement, blind sampling                          | editorial | **BLOCKED** — needs one independent qualified reviewer (D3) |

### Stage 5 — Lawful acquisition (D2 residual)

CourtListener bulk migration first (R4-002), then the remaining adapters and
relevance work (R4-_, R5-_), rights taxonomy and snapshot rights (R3-001…R3-006,
R3-010…R3-015), and P0-016…P0-024. All PENDING; see the inventory.

### Stage 6 — Publication, replication, citator

R7-* publication and SKOS profile work, R8-* operations, R9-* replication,
R10-* citator, plus P1-030…P1-037. Partly moved today (R7-003, R7-004, R7-018,
P1-033); the rest PENDING.

## Site track — runs alongside, in this repo

| ID                         | Work                                                                                                                         | Status                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P1-001 / R7-003            | Registry-minted opaque concept IRIs                                                                                          | **DONE**                                                                                |
| P1-002                     | Legacy route IRIs published per concept (`digest:legacyIri`)                                                                 | **PARTIAL** — redirects pending                                                         |
| P1-006 / R7-004            | Folder parent no longer injected into `skos:broader`; placement published separately                                         | **DONE**                                                                                |
| P1-014B / R7-018           | One prefLabel per language; pref/alt/historical pairwise disjoint                                                            | **DONE**                                                                                |
| P1-014C / R7-019           | Typed canonical `skos:notation`; corpus notation demoted to `digest:pathNotation`                                            | **PARTIAL** — datatype not published                                                    |
| P1-014H / R7-025           | Append-only registry, ids never reused                                                                                       | **PARTIAL** — split/merge/deprecate events pending                                      |
| P1-014I / P1-033 / R7-008  | Language tags data-driven; only natural language tagged                                                                      | **PARTIAL** — runner now writes `language`; the 1,811 existing digests are unbackfilled |
| P1-024                     | Site unit tests                                                                                                              | **IN PROGRESS** — 28 tests                                                              |
| P1-014E / R7-021           | `skos:topConceptOf` still inferred from folder roots                                                                         | PENDING                                                                                 |
| P1-014A / R7-017           | Scheme IRI still the legacy route base                                                                                       | PENDING                                                                                 |
| P1-014D / P1-014F / R7-002 | SHACL: hierarchy inverse/closure, mapping direction                                                                          | PENDING                                                                                 |
| P1-014G / R7-024           | w3id redirects for concept/vocab/datatype namespaces                                                                         | PENDING                                                                                 |
| P0-015                     | Public methodology page promises a two-source merge floor the merge gate does not enforce (`src/pages/methodology.astro:38`) | PENDING — honesty defect, live                                                          |
| P1-027                     | `format:check` matches zero files, exits 2                                                                                   | **BROKEN** — CI red                                                                     |
| P1-026                     | Lint green after toolchain change; `console.warn` still present                                                              | **REGRESSED**                                                                           |
| P1-025                     | `check` is style lint, not `astro check`; no type check runs                                                                 | **UNEXERCISED**                                                                         |
| P1-028                     | CI builds without the corpus in a 3-minute job                                                                               | PENDING                                                                                 |
| P1-029                     | Site depends on a private sibling checkout (`src/corpus.config.ts`)                                                          | PENDING                                                                                 |

## Standing risks and blocks

| Ref | Item                                                                                                                                                                               | Status                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D4  | Republishing retained source full text under the § 105 / _Georgia v. PRO_ theory while the rights schema is built — including personal data in filings and private secondary works | **RISK-ACCEPTED** 2026-07-30. Expires when the rights schema lands, or on any takedown, complaint, or contrary counsel advice |
| D2  | Acquisition continues on the 100-proxy pool                                                                                                                                        | **RISK-ACCEPTED** — retires with R4-002                                                                                       |
| D3  | No public "validated" or competitive-quality claim in pilot mode                                                                                                                   | **BLOCKED** until an independent qualified reviewer exists                                                                    |
| D3  | Staffing re-decision before the first curated-beta release candidate                                                                                                               | PENDING trigger                                                                                                               |

## Deferred, explicitly open

Public IRI migration is now decided and executed site-side; what remains
deferred from D1: publishing topology at scale (the static build suffices for
pilot scale), and counsel review of source classes (D4 trigger-driven).

## Complete inventory

Every row of both plans. Statuses default to the plan's own PENDING; anything
else was measured or changed on the date in the change log.

### Brownfield P0 — preserve and repair evidence (all-generated plan)

| ID      | Task                                                  | Owner     | Status  |
| ------- | ----------------------------------------------------- | --------- | ------- |
| P0-001  | Freeze the complete generated snapshot                | runner    | PENDING |
| P0-002  | Bind every assumed bundle to one canonical issue ID   | runner    | PENDING |
| P0-003  | Replace positional source association                 | runner    | PENDING |
| P0-004  | Reconstruct edition source associations               | runner    | PENDING |
| P0-005  | Preserve generation manifests as immutable provenance | runner    | PENDING |
| P0-006  | Generate separate current-edition manifests           | runner    | PENDING |
| P0-007  | Correct runner version provenance                     | runner    | PENDING |
| P0-008  | Add source redistribution disposition                 | runner    | PENDING |
| P0-008A | Add privacy and sensitivity disposition               | runner    | PENDING |
| P0-008B | Store source bodies once                              | runner    | PENDING |
| P0-009  | Separate full acquired bytes from research excerpts   | runner    | PENDING |
| P0-010  | Make the ordinary merge path enforce release policy   | runner    | PENDING |
| P0-011  | Stop regeneration from overwriting reviewed editions  | runner    | PENDING |
| P0-012  | Build claim-to-evidence records                       | runner    | PENDING |
| P0-013  | Quarantine unsupported claims                         | runner    | PENDING |
| P0-014  | Build and execute the lawyer gold set                 | editorial | PENDING |
| P0-015  | Correct public methodology claims                     | site      | PENDING |
| P0-016  | Build a source-relevance benchmark                    | runner    | PENDING |
| P0-017  | Add conservative topical-relevance gating             | runner    | PENDING |
| P0-017A | Classify document kind from the document              | runner    | PENDING |
| P0-018  | Fetch eCFR through the official content API           | runner    | PENDING |
| P0-018A | Unify dedicated-probe and ordinary regulatory intake  | runner    | PENDING |
| P0-018B | Gate CFR topical applicability                        | runner    | PENDING |
| P0-019  | Unify document-validity thresholds                    | runner    | PENDING |
| P0-020  | Normalize authority identity                          | runner    | PENDING |
| P0-021  | Add jurisdiction and temporal scope to claims         | runner    | PENDING |
| P0-022  | Build an authority update feed                        | runner    | PENDING |
| P0-023  | Build treatment data as a separate citator program    | runner    | PENDING |
| P0-024  | Review proxy use and source terms                     | editorial | PENDING |

### Brownfield P1 — taxonomy, editorial, tests, publishing (all-generated plan)

| ID      | Task                                                    | Owner       | Status                                                                                            |
| ------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| P1-001  | Mint UUID-based public concept IRIs                     | site        | **DONE** (site)                                                                                   |
| P1-002  | Preserve all legacy path aliases                        | site        | **PARTIAL** — legacy IRIs published; w3id redirects pending (P1-014G)                             |
| P1-003  | Type all concepts                                       | editorial   | PENDING                                                                                           |
| P1-004  | Remove scaffolds from the validated issue channel       | editorial   | PENDING                                                                                           |
| P1-005  | Build the approximately 600-topic entry layer           | editorial   | PENDING                                                                                           |
| P1-005A | Reconcile physical and v3 root systems                  | editorial   | PENDING                                                                                           |
| P1-006  | Add polyhierarchy                                       | runner      | **PARTIAL** — structural injection removed; polyhierarchy curation pending                        |
| P1-007  | Add associative relationships                           | editorial   | PENDING                                                                                           |
| P1-008  | Complete dedicated definitions                          | editorial   | PENDING                                                                                           |
| P1-009  | Complete scope notes                                    | editorial   | PENDING                                                                                           |
| P1-010  | Review FOLIO mappings                                   | editorial   | PENDING                                                                                           |
| P1-011  | Produce the real FOLIO build manifest                   | runner      | PENDING                                                                                           |
| P1-012  | Archive the full item-level concordance                 | runner      | PENDING                                                                                           |
| P1-013  | Add strict authoring schema                             | runner      | PENDING                                                                                           |
| P1-014  | Add SHACL and SKOS integrity validation                 | runner      | PENDING                                                                                           |
| P1-014A | Separate stable scheme and immutable release identity   | site        | PENDING                                                                                           |
| P1-014B | Enforce label integrity                                 | site        | **DONE** (site)                                                                                   |
| P1-014C | Govern notation                                         | site        | **PARTIAL** — typed notation emitted; datatype not published                                      |
| P1-014D | Validate hierarchy and association semantics            | site        | PENDING                                                                                           |
| P1-014E | Review top concepts                                     | site        | PENDING                                                                                           |
| P1-014F | Validate mapping-property semantics                     | site        | PENDING                                                                                           |
| P1-014G | Qualify W3ID persistence behavior                       | site        | PENDING                                                                                           |
| P1-014H | Implement concept lifecycle without IRI reuse           | site        | **PARTIAL** — non-reuse + registry policy; split/merge events pending                             |
| P1-014I | Tag only natural-language literals                      | site+runner | **PARTIAL** — exporter data-driven and the runner emits `language`; existing digests unbackfilled |
| P1-015  | Create explicit editorial statuses                      | editorial   | PENDING                                                                                           |
| P1-016  | Record reviewer competence and decisions                | editorial   | PENDING                                                                                           |
| P1-017  | Establish two-reviewer adjudication                     | editorial   | PENDING                                                                                           |
| P1-018  | Publish an error taxonomy                               | editorial   | PENDING                                                                                           |
| P1-019  | Benchmark lawyer task performance                       | editorial   | PENDING                                                                                           |
| P1-020  | Define release stop rules                               | editorial   | PENDING                                                                                           |
| P1-021  | Replace obsolete per-PR path tests                      | runner      | PENDING                                                                                           |
| P1-022  | Make the runner suite green                             | runner      | PENDING                                                                                           |
| P1-023  | Raise runner coverage                                   | runner      | PENDING                                                                                           |
| P1-024  | Add site unit and integration tests                     | site        | **IN PROGRESS** — 29 unit tests; integration/coverage pending                                     |
| P1-025  | Fix the site check heap                                 | site        | **UNEXERCISED** — `check` is now style lint, not `astro check`                                    |
| P1-026  | Fix site lint                                           | site        | **REGRESSED** — exits 0 after toolchain change, `console.warn` still present                      |
| P1-027  | Fix site formatting                                     | site        | **BROKEN** — `oxfmt --check .` matches 0 files, exits 2; CI red                                   |
| P1-028  | Replace three-minute/full-corpus CI mismatch            | site        | PENDING                                                                                           |
| P1-029  | Decouple the site from a private sibling checkout       | site        | PENDING                                                                                           |
| P1-030  | Replace monolithic static generation                    | site        | PENDING                                                                                           |
| P1-031  | Add production observability and error budgets          | site        | PENDING                                                                                           |
| P1-032  | Define the jurisdiction package schema                  | runner      | PENDING                                                                                           |
| P1-033  | Remove hardcoded English from RDF export                | site        | **DONE** (site)                                                                                   |
| P1-034  | Build local professional vocabulary from local evidence | runner      | PENDING                                                                                           |
| P1-035  | Appoint local specialist review                         | editorial   | PENDING                                                                                           |
| P1-036  | Map, do not force equivalence                           | editorial   | PENDING                                                                                           |
| P1-037  | Validate native-language search                         | site        | PENDING                                                                                           |

### Phase 0 — governance, scope, stop rules (from-scratch plan)

| ID     | Task                                                          | Owner     | Status  |
| ------ | ------------------------------------------------------------- | --------- | ------- |
| R0-001 | Approve the product-scope statement for digest versus citator | editorial | PENDING |
| R0-002 | Appoint an editorial board                                    | editorial | PENDING |
| R0-003 | Appoint jurisdiction-specific legal panels                    | editorial | PENDING |
| R0-004 | Appoint a law-librarian/knowledge-organization panel          | editorial | PENDING |
| R0-005 | Approve reviewer-conflict and independence policy             | editorial | PENDING |
| R0-006 | Approve correction, dispute, withdrawal, and appeal policy    | editorial | PENDING |
| R0-007 | Approve source-access ethics and provider-terms policy        | editorial | PENDING |
| R0-008 | Approve stop rules                                            | editorial | PENDING |
| R0-009 | Approve claims and metrics vocabulary                         | editorial | PENDING |
| R0-010 | Approve funding-stage gates                                   | editorial | PENDING |

### Phase 1 — canonical contracts and identity (from-scratch plan)

| ID     | Task                                     | Owner       | Status                                                                                        |
| ------ | ---------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| R1-001 | Define the `Concept` schema              | runner      | PENDING                                                                                       |
| R1-002 | Define the concept-kind enumeration      | runner      | PENDING                                                                                       |
| R1-003 | Define the `Label` schema                | runner      | PENDING                                                                                       |
| R1-004 | Define the `Note` schema                 | runner      | PENDING                                                                                       |
| R1-005 | Define `ConceptRelation`                 | runner      | PENDING                                                                                       |
| R1-006 | Define `Placement`                       | runner      | PENDING                                                                                       |
| R1-007 | Define `SourceRecord`                    | runner      | PENDING                                                                                       |
| R1-008 | Define `SourceSnapshot`                  | runner      | PENDING                                                                                       |
| R1-009 | Define `Authority`                       | runner      | PENDING                                                                                       |
| R1-010 | Define `EvidenceSpan`                    | runner      | PENDING                                                                                       |
| R1-011 | Define `DigestClaim`                     | runner      | PENDING                                                                                       |
| R1-012 | Define `DigestRevision`                  | runner      | PENDING                                                                                       |
| R1-013 | Define `EditorialDecision`               | runner      | PENDING                                                                                       |
| R1-014 | Define `RunAttempt`                      | runner      | PENDING                                                                                       |
| R1-015 | Define `ReleaseManifest`                 | runner      | PENDING                                                                                       |
| R1-016 | Choose the opaque-ID algorithm           | site+runner | **DONE** — allocated in the runner (`skos_okf.mint_concept_id`), adopted by the site registry |
| R1-017 | Reserve the persistent concept namespace | site        | PENDING                                                                                       |
| R1-018 | Implement a route registry               | site        | **PARTIAL** — registry keys are route history; redirects pending                              |
| R1-019 | Implement schema migrations              | runner      | PENDING                                                                                       |
| R1-020 | Prove canonical/export round-trip parity | runner      | PENDING                                                                                       |

### Phase 2 — issue registry and topic entry (from-scratch plan)

| ID     | Task                                               | Owner     | Status  |
| ------ | -------------------------------------------------- | --------- | ------- |
| R2-001 | Publish the concept-formation handbook             | editorial | PENDING |
| R2-002 | Inventory public law-library subject guides        | editorial | PENDING |
| R2-003 | Inventory public controlled vocabularies           | editorial | PENDING |
| R2-004 | Inventory historical digest/treatise warrant       | editorial | PENDING |
| R2-005 | Inventory modern open legal/pedagogical warrant    | editorial | PENDING |
| R2-006 | Generate topic-entry candidates with source counts | editorial | PENDING |
| R2-007 | Adjudicate 400–700 topic-entry terms               | editorial | PENDING |
| R2-008 | Test topic-entry usability with lawyers            | editorial | PENDING |
| R2-009 | Test topic-entry usability with law librarians     | editorial | PENDING |
| R2-010 | Type every candidate heading before minting        | editorial | PENDING |
| R2-011 | Adjudicate equivalence/merge candidates            | editorial | PENDING |
| R2-012 | Adjudicate split candidates                        | editorial | PENDING |
| R2-013 | Adjudicate broader relations                       | editorial | PENDING |
| R2-014 | Adjudicate alternate placements                    | editorial | PENDING |
| R2-015 | Adjudicate associative relations                   | editorial | PENDING |
| R2-016 | Define typed legal relations                       | editorial | PENDING |
| R2-017 | Validate hierarchy cycles and self-relations       | editorial | PENDING |
| R2-018 | Define external coverage benchmarks                | editorial | PENDING |

### Phase 3 — source rights and authority intake (from-scratch plan)

| ID     | Task                                                      | Owner     | Status  |
| ------ | --------------------------------------------------------- | --------- | ------- |
| R3-001 | Publish the source-rights taxonomy                        | editorial | PENDING |
| R3-002 | Add rights fields to every snapshot                       | runner    | PENDING |
| R3-003 | Create attribution generation                             | runner    | PENDING |
| R3-004 | Obtain counsel review for source classes                  | editorial | PENDING |
| R3-005 | Create PD/open/restricted partitions                      | runner    | PENDING |
| R3-006 | Define source-adapter protocol                            | runner    | PENDING |
| R3-007 | Implement immutable source-snapshot IDs                   | runner    | PENDING |
| R3-008 | Replace every positional source join                      | runner    | PENDING |
| R3-009 | Add arbitrary-rejection property tests                    | runner    | PENDING |
| R3-010 | Normalize authority identity                              | runner    | PENDING |
| R3-011 | Model authority versions/effective dates                  | runner    | PENDING |
| R3-012 | Build a court/issuer/jurisdiction registry                | runner    | PENDING |
| R3-013 | Define and enforce privacy/sensitivity dispositions       | runner    | PENDING |
| R3-014 | Store source bodies once and model occurrences separately | runner    | PENDING |
| R3-015 | Normalize source profiles to a governed enum              | runner    | PENDING |

### Phase 4 — lawful primary-law acquisition (from-scratch plan)

| ID      | Task                                                            | Owner  | Status  |
| ------- | --------------------------------------------------------------- | ------ | ------- |
| R4-001  | Implement a rate-respecting acquisition queue                   | runner | PENDING |
| R4-002  | Implement CourtListener/bulk-case adapter under permitted terms | runner | PENDING |
| R4-003  | Qualify the existing GovInfo content-link pattern               | runner | PENDING |
| R4-004  | Implement eCFR developer-API content/version retrieval          | runner | PENDING |
| R4-004A | Route every eCFR/CFR candidate through one regulatory adapter   | runner | PENDING |
| R4-004B | Gate CFR topical applicability                                  | runner | PENDING |
| R4-005  | Implement official U.S. Code/version adapter                    | runner | PENDING |
| R4-006  | Implement federal court-rules adapter                           | runner | PENDING |
| R4-007  | Implement state-source adapter framework                        | runner | PENDING |
| R4-008  | Implement document-type validation                              | runner | PENDING |
| R4-008A | Classify legal document kind from metadata/content              | runner | PENDING |
| R4-009  | Calibrate content completeness per source type                  | runner | PENDING |
| R4-010  | Implement duplicate snapshot and canonical URL handling         | runner | PENDING |
| R4-011  | Implement temporal/jurisdiction query constraints               | runner | PENDING |
| R4-012  | Record attempted channels and typed failures                    | runner | PENDING |

### Phase 5 — relevance, claims, evidence (from-scratch plan)

| ID     | Task                                                 | Owner     | Status  |
| ------ | ---------------------------------------------------- | --------- | ------- |
| R5-001 | Build a lawyer-labeled source-relevance set          | editorial | PENDING |
| R5-002 | Label jurisdictional applicability separately        | editorial | PENDING |
| R5-003 | Label temporal applicability separately              | editorial | PENDING |
| R5-004 | Evaluate deterministic relevance filters             | runner    | PENDING |
| R5-005 | Evaluate semantic rerankers                          | runner    | PENDING |
| R5-006 | Fix relevance thresholds before production           | runner    | PENDING |
| R5-007 | Define digest claim types                            | runner    | PENDING |
| R5-008 | Generate structured claims before prose              | runner    | PENDING |
| R5-009 | Require evidence spans for material claims           | runner    | PENDING |
| R5-010 | Verify quotations deterministically                  | runner    | PENDING |
| R5-011 | Verify citations resolve to authorities              | runner    | PENDING |
| R5-012 | Detect contrary/limiting authority candidates        | runner    | PENDING |
| R5-013 | Define zero/insufficient-evidence output             | runner    | PENDING |
| R5-014 | Render Markdown only from accepted claims            | runner    | PENDING |
| R5-015 | Generate authority tables from canonical authorities | runner    | PENDING |

### Phase 6 — conservative review and evaluation (from-scratch plan)

| ID     | Task                                           | Owner     | Status  |
| ------ | ---------------------------------------------- | --------- | ------- |
| R6-001 | Define reviewer qualifications by task         | editorial | PENDING |
| R6-002 | Publish issue-classification rubric            | editorial | PENDING |
| R6-003 | Publish source-relevance rubric                | editorial | PENDING |
| R6-004 | Publish claim-support/legal-correctness rubric | editorial | PENDING |
| R6-005 | Publish relationship/mapping rubric            | editorial | PENDING |
| R6-006 | Build the review workspace                     | editorial | PENDING |
| R6-007 | Enforce reviewer independence                  | editorial | PENDING |
| R6-008 | Dual-review the gold set                       | editorial | PENDING |
| R6-009 | Implement disagreement adjudication            | editorial | PENDING |
| R6-010 | Pre-register metrics and thresholds            | editorial | PENDING |
| R6-011 | Evaluate concept-kind accuracy                 | editorial | PENDING |
| R6-012 | Evaluate hierarchy/relationship accuracy       | editorial | PENDING |
| R6-013 | Evaluate source relevance/applicability        | editorial | PENDING |
| R6-014 | Evaluate claim support and legal correctness   | editorial | PENDING |
| R6-015 | Measure inter-reviewer agreement               | editorial | PENDING |
| R6-016 | Measure reviewer drift                         | editorial | PENDING |
| R6-017 | Run blind release sampling                     | editorial | PENDING |
| R6-018 | Run lawyer retrieval-usability evaluation      | editorial | PENDING |

### Phase 7 — SKOS, FOLIO, multilingual, publication (from-scratch plan)

| ID     | Task                                                                             | Owner     | Status                                                             |
| ------ | -------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| R7-001 | Publish the SKOS application profile                                             | site      | PENDING                                                            |
| R7-002 | Publish SHACL shapes                                                             | site      | PENDING                                                            |
| R7-003 | Implement opaque concept IRI export                                              | site      | **DONE** (site)                                                    |
| R7-004 | Remove structural-parent semantic injection                                      | site      | **DONE** (site)                                                    |
| R7-005 | Implement full mapping predicates                                                | site      | PENDING                                                            |
| R7-006 | Pin the FOLIO snapshot                                                           | runner    | PENDING                                                            |
| R7-007 | Review FOLIO mapping strength                                                    | editorial | PENDING                                                            |
| R7-008 | Implement BCP 47 tags on natural-language literals throughout                    | site      | **PARTIAL** — exporter tags from data; no multilingual data exists |
| R7-009 | Implement multilingual search and display                                        | site      | PENDING                                                            |
| R7-010 | Build signed release artifacts                                                   | site      | PENDING                                                            |
| R7-011 | Implement deterministic publication projections                                  | site      | PENDING                                                            |
| R7-012 | Implement concept/document content negotiation                                   | site      | PENDING                                                            |
| R7-013 | Publish versioned bulk downloads                                                 | site      | PENDING                                                            |
| R7-014 | Implement release link/integrity validation                                      | site      | PENDING                                                            |
| R7-015 | Implement accessibility and print gates                                          | site      | PENDING                                                            |
| R7-016 | Implement a clean-environment reproducible build                                 | site      | PENDING                                                            |
| R7-017 | Separate stable scheme-series identity from immutable release identity           | site      | PENDING                                                            |
| R7-018 | Enforce label S13/S14 integrity                                                  | site      | **DONE** (site)                                                    |
| R7-019 | Publish and validate the concept-notation datatype                               | site      | **PARTIAL** — datatype used, not yet published/validated           |
| R7-020 | Validate hierarchy inverse and closure semantics                                 | site      | PENDING                                                            |
| R7-021 | Review top-concept assertions                                                    | site      | PENDING                                                            |
| R7-022 | Validate SKOS mapping direction and disjointness                                 | site      | PENDING                                                            |
| R7-023 | Inspect FOLIO target RDF types and choose compatibility policy                   | editorial | PENDING                                                            |
| R7-024 | Test W3ID redirect configuration and persistence separately from representations | site      | PENDING                                                            |
| R7-025 | Implement split/merge/deprecation identity lifecycle                             | site      | **PARTIAL** — no-reuse implemented; lifecycle events pending       |

### Phase 8 — operational quality and security (from-scratch plan)

| ID     | Task                                              | Owner  | Status  |
| ------ | ------------------------------------------------- | ------ | ------- |
| R8-001 | Implement transactional work leases               | runner | PENDING |
| R8-002 | Implement bounded retries and terminal failures   | runner | PENDING |
| R8-003 | Bind run provenance transactionally to revisions  | runner | PENDING |
| R8-004 | Recompute manifests during release                | runner | PENDING |
| R8-005 | Implement structured quality telemetry            | runner | PENDING |
| R8-006 | Create a threat model                             | runner | PENDING |
| R8-007 | Isolate secrets and restricted sources            | runner | PENDING |
| R8-008 | Add prompt/source injection defenses              | runner | PENDING |
| R8-009 | Add model-trace/output hygiene gates              | runner | PENDING |
| R8-010 | Build unit tests with branch coverage             | runner | PENDING |
| R8-011 | Build adapter contract tests with fake transports | runner | PENDING |
| R8-012 | Build migration/property tests                    | runner | PENDING |
| R8-013 | Build integration and smoke tests                 | runner | PENDING |
| R8-014 | Selectively mutation-test identity/evidence logic | runner | PENDING |
| R8-015 | Define backup, restore, and disaster recovery     | runner | PENDING |
| R8-016 | Define incident and urgent correction procedure   | runner | PENDING |

### Phase 9 — international replication (from-scratch plan)

| ID     | Task                                              | Owner     | Status  |
| ------ | ------------------------------------------------- | --------- | ------- |
| R9-001 | Define the jurisdiction registry                  | runner    | PENDING |
| R9-002 | Define the replication-kit template               | runner    | PENDING |
| R9-003 | Select a second-jurisdiction pilot                | runner    | PENDING |
| R9-004 | Inventory local professional vocabularies         | runner    | PENDING |
| R9-005 | Inventory local official/open sources             | runner    | PENDING |
| R9-006 | Form a local topic-entry layer                    | runner    | PENDING |
| R9-007 | Build local authority and citation adapters       | runner    | PENDING |
| R9-008 | Create local-language definitions and scope notes | runner    | PENDING |
| R9-009 | Review cross-jurisdiction mappings                | runner    | PENDING |
| R9-010 | Run local gold-set evaluation                     | runner    | PENDING |
| R9-011 | Publish jurisdiction-specific governance          | editorial | PENDING |
| R9-012 | Demonstrate independent replication               | runner    | PENDING |

### Phase 10 — citator-quality authority treatment (from-scratch plan)

| ID      | Task                                     | Owner     | Status  |
| ------- | ---------------------------------------- | --------- | ------- |
| R10-001 | Define authority citation graph schema   | runner    | PENDING |
| R10-002 | Define procedural-history schema         | runner    | PENDING |
| R10-003 | Define treatment taxonomy and rubric     | editorial | PENDING |
| R10-004 | Build case-to-case citation extraction   | runner    | PENDING |
| R10-005 | Build treatment candidate extraction     | runner    | PENDING |
| R10-006 | Human-review treatment assertions        | editorial | PENDING |
| R10-007 | Build statute/regulation version lineage | runner    | PENDING |
| R10-008 | Build coverage disclosure                | runner    | PENDING |
| R10-009 | Build lawful citator benchmark           | runner    | PENDING |
| R10-010 | Evaluate treatment accuracy and recall   | runner    | PENDING |
| R10-011 | Implement update alerts and re-review    | runner    | PENDING |
| R10-012 | Approve citator public positioning       | editorial | PENDING |

### Good to have — after required launch gates (from-scratch plan)

| ID    | Task                                     | Owner     | Status  |
| ----- | ---------------------------------------- | --------- | ------- |
| G-001 | Build active-learning review queues      | runner    | PENDING |
| G-002 | Build reviewer expertise matching        | runner    | PENDING |
| G-003 | Add public correction submissions        | runner    | PENDING |
| G-004 | Add a public error bounty                | runner    | PENDING |
| G-005 | Publish a stable query API               | site      | PENDING |
| G-006 | Publish SPARQL                           | site      | PENDING |
| G-007 | Add PROV-O export                        | site      | PENDING |
| G-008 | Evaluate SKOS-XL                         | runner    | PENDING |
| G-009 | Build offline/print release packages     | site      | PENDING |
| G-010 | Build change webhooks/subscriptions      | site      | PENDING |
| G-011 | Run a classroom study                    | editorial | PENDING |
| G-012 | Run a practitioner diary study           | editorial | PENDING |
| G-013 | Run opposing-specialist red teams        | editorial | PENDING |
| G-014 | Build cross-language candidate discovery | runner    | PENDING |
| G-015 | Support federated jurisdiction hosting   | runner    | PENDING |
| G-016 | Add citation-context embeddings          | runner    | PENDING |

## Change log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-31 | Ledger created, consolidating both 2026-07-29 plan sets under D1–D4. Site-side concept identity and label profile implemented (P1-001, P1-002 partial, P1-006, P1-014B, P1-014C partial, P1-014H partial, P1-014I partial, P1-033, R1-016, R1-018 partial, R7-003, R7-004, R7-008 partial, R7-018, R7-019 partial, R7-025 partial); see [the design note](2026-07-31-concept-identity.md). Measured and recorded: `format:check` broken, `lint` regressed, `check` unexercised. |
| 2026-07-31 | Format gate repaired — `oxfmt --check .` had been matching zero files, failing CI and every commit hook.                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-31 | Runner: digests are now generated with `concept_id` and `language`, identity carried across regeneration and repair, label sets made disjoint at write time, and the researcher prompt updated (R1-016, part of P1-014B/I). The site registry adopts runner-allocated ids.                                                                                                                                                                                                      |
