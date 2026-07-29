# Runner v3 Proposals — All 137,139 Digests Generated — 2026-07-29

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

## Decision context

This document is the **brownfield** plan. It assumes that all **137,139
canonical U.S. issue records** in `key_digest/issues_v3.jsonl` have already
been researched and materialized as bundles in the format produced by the
runner on 2026-07-29. “Canonical” here means identity-normalized in the ledger,
not adjudicated as a substantive legal issue. The generated corpus is valuable
evidence, but generation is not treated as validation.

The separate greenfield plan assumes that no digest has been generated. Do not
combine its sequencing with this one: in the brownfield case the first duty is
to preserve, inventory, assess, and selectively repair the generated corpus.

Only two implementation states are used:

- **DONE** — present in code or data and supported by named evidence.
- **PENDING** — absent, not enforced, not measured, or not good enough for the
  stated quality bar.

An implementation is not marked DONE merely because a prompt or reviewer
instruction requests it. Enforcement, persisted evidence, and a test or
measured output must agree.

## Planning assumption versus measured checkout

| Fact                                                                                                                                                                                                                                                                 | State   | Evidence                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Canonical issue universe contains 137,139 records derived from 156,802 source items                                                                                                                                                                                  | DONE    | `wc -l key_digest/issues_v3.jsonl`; summing `n_items` on 2026-07-29                                                |
| v3 ledger contains 1,607 merged issues and 10,177 multi-item issues; maximum membership is 271                                                                                                                                                                       | DONE    | Fresh `issues_v3.jsonl` scan                                                                                       |
| v3 path depths are 2,826 at depth 3; 22,913 at 4; 58,772 at 5; 41,276 at 6; 10,166 at 7; and 1,186 at 8                                                                                                                                                              | DONE    | Fresh `issues_v3.jsonl` scan                                                                                       |
| v3 FOLIO area coordinates are 104,572 real `R*` identifiers and 32,567 local `x-digest-*` values; all 137,139 objective coordinates are `R*` identifiers                                                                                                             | DONE    | Fresh `issues_v3.jsonl` scan; operational anchors, not reviewed SKOS mappings                                      |
| Measured checkout contains 1,705 digest files, 1,636 `run.json` manifests, 69 bundles without `run.json`, and 7,436 source Markdown files                                                                                                                            | DONE    | Fresh filesystem/frontmatter scan at runner commit `265a8610695067d825392751ffdb3e5932a0aefd`, 2026-07-29          |
| Measured physical roots are 31 current doctrinal plus 10 legacy composite; five of 36 v3 doctrinal areas are absent physically and naive coexistence would expose 46 roots                                                                                           | DONE    | Fresh filesystem and v3 ledger reconciliation                                                                      |
| Most recent 14 bundles contain 131 retained sources (minimum/mean/maximum 3/9.357/21), but only 3 dedicated definitions, 3 scope notes, 1 alternate-label set, no `related`/`narrower`/multi-`broader`/typed legal relations, 13 FOLIO groups, and no other mappings | DONE    | Date-sorted bundle/frontmatter scan at the evidence cutoff                                                         |
| In those 14 bundles, 63 of 75 distinct Markdown HTTP links exactly match retained resource URLs; 8 bundles have a link and one 10-source bundle has none                                                                                                             | DONE    | Digest-link versus source-frontmatter comparison; this is a grounding proxy, not accuracy                          |
| Source count, byte volume, and error prevalence in the assumed 137,139-bundle corpus are known                                                                                                                                                                       | PENDING | They must be measured from the completed snapshot; this plan does not linearly extrapolate the 1,705-bundle sample |

The measured checkout is used to identify defects in the machinery. Where the
same machinery produced all 137,139 assumed bundles, the defect is treated as a
corpus-wide **risk**, not as a claim that every bundle is wrong.

## What v3 has implemented

### Atomic DONE items

| ID   | State | Implemented result                                                                                                                                                         | Evidence                                                                                                             |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| D-01 | DONE  | Research units are canonical issues rather than raw historical items.                                                                                                      | `key_digest/build_issues_v3.py:86-228`; `issues_v3.jsonl` has 137,139 lines and represents 156,802 item memberships. |
| D-02 | DONE  | Missing `issue.id`, `item_id`, Area of Law path, or Objective path fails the derivative build.                                                                             | `key_digest/build_issues_v3.py:128-177`                                                                              |
| D-03 | DONE  | Conflicting non-null FOLIO anchors for merged items fail the build.                                                                                                        | `key_digest/build_issues_v3.py:99-126`                                                                               |
| D-04 | DONE  | The operational record carries stable `issue_id`, item IDs, primary Area of Law path, primary Objective path, and FOLIO anchors.                                           | `key_digest/build_issues_v3.py:18-50` and the current `issues_v3.jsonl` shape                                        |
| D-05 | DONE  | CourtListener, GovInfo, and eCFR are probed for every issue and failures are recorded without aborting the other channels.                                                 | `runner/legal_probe.py:819-925`                                                                                      |
| D-06 | DONE  | GovInfo search results are fetched through their text or XML content link instead of retaining the seven-character application shell.                                      | `docs/TODO.md`, item 2, “GovInfo”; current `ProbeHit.fetch_url` path in `runner/legal_probe.py:794-810`              |
| D-07 | DONE  | Retention refuses explicitly non-legal hosts and source bodies shorter than 200 characters.                                                                                | `runner/source_classify.py:400-421`; `tests/test_retention_gate.py`                                                  |
| D-08 | DONE  | Curated and probe-acquired sources pass through the retention function before being written.                                                                               | `runner/run_key_digest_research_workers.py:1289-1341`                                                                |
| D-09 | DONE  | Caselaw and statutory indexes are deterministically generated, including documented-absence output.                                                                        | `runner/render_indexes.py`; writes at `runner/run_key_digest_research_workers.py:1414-1428`                          |
| D-10 | DONE  | A successful generation writes issue, run, configuration, probe, evidence, and current-`SaveRecord` file-inventory data. It is not a complete post-rerun edition manifest. | `runner/run_manifest.py:94-134`                                                                                      |
| D-11 | DONE  | Every generated Markdown artifact passes the shared OKF normalizer and linter before write.                                                                                | `runner/run_key_digest_research_workers.py:1237-1265`                                                                |
| D-12 | DONE  | The corpus has a repair tool that normalizes known legacy defects and refreshes hashes for manifest entries it already knows about.                                        | `key_digest/repair_okf_bundle.py:268-399`                                                                            |
| D-13 | DONE  | A reviewer instruction requires at least two non-hidden on-disk source files before merge.                                                                                 | `main.py:1329-1350`                                                                                                  |
| D-14 | DONE  | The public site renders digest, source, audit, index, provenance, search, and SKOS surfaces at `digest.law`.                                                               | `digest-law-us` routes and components; site build/deployment record in runner `CHANGELOG.md`                         |

These are real engineering assets. They preserve enough generation context to
make a brownfield repair program possible. They do not establish legal
correctness, topical fit, citator functionality, or editorial parity with a
professional digest.

## Required proposals

### R-01 — Preserve the completed corpus before any repair

**State: PENDING**

**Problem.** A corpus-scale repair can erase the evidence needed to understand
how the corpus was generated. Re-runs have already replaced previously
remediated directories.

**Evidence.** `docs/TODO.md`, item 7, records 985 of 3,010 historical topic
directories written by more than one research commit and a confirmed
`IMPERATIVE_NATURE_OF_WILLS` clobber. The worker writes directly into the topic
directory, and the generation flow has no immutable revision object.

**Cause.** The filesystem directory is simultaneously the generation target,
the current editorial edition, and the publication source. There is no
append-only bundle revision layer.

**Remediation.**

1. Freeze the assumed complete tree as release `generated-2026-07-29`.
2. Produce a content-addressed inventory of every file, bundle, issue ID,
   source URL, byte count, and SHA-256.
3. Store the frozen snapshot as immutable object storage plus an archival
   manifest; do not rely on Git alone for multi-gigabyte source bodies.
4. Route all corrections into new revision records. Never mutate the frozen
   generation record.

**Acceptance criteria.**

- The inventory resolves exactly one bundle to each of the 137,139 issue IDs.
- Recomputing all hashes reproduces the release manifest with zero differences.
- A correction creates a new revision and leaves the generated revision
  byte-for-byte retrievable.
- A disaster-recovery restore is exercised and hash-verified.

### R-02 — Fix source-to-file association before trusting evidence buckets

**State: PENDING**

**Problem.** If a curated source is refused, later retained files can be
assigned to the wrong original source metadata during classification. That can
corrupt evidence buckets, filenames, source counts, index rows, and manifest
records.

**Evidence.**

- The save loop skips refused entries and appends only accepted `SaveRecord`s:
  `runner/run_key_digest_research_workers.py:1289-1313`.
- `classify_retained_sources()` iterates the original, unfiltered
  `source_documents` list but assigns the compacted list of saved filenames by
  numeric position: `runner/run_key_digest_research_workers.py:1152-1182`.

**Cause.** Identity is represented by parallel array position rather than by a
single retained-source record carrying source document, text, output path,
origin, and decision.

**Remediation.**

1. Introduce an immutable `RetainedSource` value with a source ID, URL, title,
   text hash, fetch hash, path, origin channel, classification, and gate
   decision.
2. Make the save loop return these records directly.
3. Derive indexes, audit, source profile, and manifest from the same records.
4. Reconstruct every assumed generated bundle from disk and audit data; flag
   ambiguous associations for re-research rather than guessing.

**Acceptance criteria.**

- A test with accepted–refused–accepted input proves that the two accepted
  files retain their own metadata and classifications.
- Each manifest evidence entry resolves by source ID to exactly one file with
  matching URL and SHA-256.
- No classification or index renderer accepts parallel source/filename
  arrays.
- The completed corpus reconciliation reports zero orphaned, duplicated, or
  ambiguous source IDs.

### R-03 — Make topical relevance a blocking, reviewable decision

**State: PENDING**

**Problem.** The current gate can reject obvious junk but deliberately does not
judge whether a legal source concerns the issue. A valid regulation from the
wrong title or a legal article triggered by a homonym can still be retained.

**Evidence.**

- `runner/source_classify.py:400-410` explicitly says, “Nothing here judges
  topicality.”
- `docs/TODO.md`, item 1, records restaurant guides retained for “accord” and a
  tax regulation retained for an adverse-possession issue.
- Lexical overlap and legal-vocabulary density were tested and rejected
  because they respectively admit homonyms and reject short genuine authority.
- The current-format forfeiture exemplar retains unrelated 50 CFR
  forfeiture/remission material, a 31 CFR `[Reserved]` section, and an
  unrelated medical-device law-firm article.
- The same exemplar labels a Studicata brief as caselaw and a California code
  page as secondary material because domain-wide rules do not distinguish an
  opinion/order from a brief, declaration, or other filing.

**Cause.** Relevance is evaluated against a short issue label, without a
structured issue definition, elements, jurisdiction, authority type, or
negative examples. The current gate has no labeled calibration set.

**Remediation.**

1. Build a lawyer-adjudicated relevance set stratified by topic, depth,
   authority type, source channel, homonym risk, and historical/modern issue.
2. Judge relevance against the issue's scope note, parent context, known
   elements, jurisdiction, and research question—not the label alone.
3. Use a high-recall candidate stage followed by a conservative semantic
   adjudicator with explicit reasons and source spans.
4. Send uncertain decisions to human review; never silently discard them.
5. Re-score the assumed complete corpus and quarantine failing source–issue
   edges without deleting source records.
6. Replace arbitrary/domain-derived source-profile strings with a governed
   document-kind enum and classifier backed by opinion, order, brief,
   declaration, docket-filing, statutory, regulatory, and secondary-source
   fixtures.

**Acceptance criteria.**

- On a held-out lawyer-labeled set, retained-source precision is at least 98%
  and primary-law recall is at least 95%.
- No critical off-topic primary authority is accepted in the release sample.
- Every rejection persists reason, model/rule version, confidence, and reviewer
  disposition.
- Threshold changes require a versioned calibration report.

### R-04 — Establish claim-to-evidence grounding, not merely bundle-level sources

**State: PENDING**

**Problem.** Two source files in a folder do not prove the digest's propositions.
The public methodology says the digest is drafted from retained texts alone,
but the current bundle contract does not link each material legal proposition
to a retained source span.

**Evidence.**

- `main.py:1329-1350` enforces only an on-disk file count in reviewer
  instructions.
- `runner/run_manifest.py:94-134` inventories files and evidence buckets but
  contains no claim ledger.
- The 2026-07-28 40-bundle judge scored the current stage 3.4/10 for citation
  support and 4.1/10 overall (`docs/assessments/2026-07-28-llm-judge.md`).
- In the latest 14 measured bundles, 63 of 75 Markdown HTTP links match a
  retained source URL, but only eight bundles contain a link and one
  10-source bundle has none. URL matching is a grounding proxy, not entailment
  or legal accuracy.

**Cause.** Sources are treated as bundle-level context. Citation syntax,
authority identity, quoted passage, proposition, and treatment are not one
normalized object.

**Remediation.**

1. Parse every digest into atomic claims: rule, element, exception, procedural
   posture, holding, historical statement, and editorial synthesis.
2. Require every non-trivial legal claim to link to one or more retained source
   spans by immutable source ID and offsets.
3. Normalize every cited authority to a canonical authority record.
4. Distinguish direct support, typed inference over supported premises,
   contrary authority, and unsupported lead.
5. Quarantine unsupported claims pending repair; do not hide the underlying
   generated text.

**Acceptance criteria.**

- 100% of material published legal claims have resolvable evidence edges.
- Editorial synthesis is a typed inference over supported premises; it is not
  an evidence exemption. Unsupported leads and open questions remain
  quarantined from published legal propositions.
- Exact quoted text matches the retained source bytes after documented
  normalization.
- A lawyer audit finds at least 99% claim support and zero critical unsupported
  propositions in each release gate sample.
- Deleting or changing a source invalidates dependent claims automatically.

### R-05 — Reconcile and version provenance manifests

**State: PENDING**

**Problem.** `run.json` is valuable generation provenance, but it is not a
reliable current-state integrity manifest after later remediation.

**Evidence from the 2026-07-29 measured checkout.**

- 1,636 manifests were scanned.
- 26 bundles referenced 48 missing files.
- 69 bundles had 130 SHA-256 mismatches.
- 62 bundles had 121 byte-count mismatches.
- 169 bundles held 855 source files absent from their manifest inventory.
- 154 bundles disagreed between `run.retained_sources` and disk.
- 166 bundles disagreed between declared evidence counts and disk.
- 169 bundles disagreed between evidence-list lengths and disk.
- 24 bundles had 44 evidence entries naming missing source files.
- 201 bundles held 995 source files absent from evidence records.
- 172 bundles had a manifest source filename set different from disk.
- The 13,020 inventory entries contain 12,309 absolute paths and only 711
  relative paths, so the manifests are not portable as release records.

**Cause.**

- Reviewer fixes add, remove, or edit files after the generation manifest.
- `repair_okf_bundle.py:360-399` refreshes hashes only for existing inventory
  entries; it does not rebuild the evidence model or add newly retained
  sources.
- `build_manifest()` inventories only paths emitted by the current
  `SaveRecord` list, leaving pre-existing rerun files outside the new
  inventory.
- One object is being asked to represent both immutable generation facts and
  mutable editorial state.

**Remediation.**

1. Preserve `run.json` as immutable generation provenance.
2. Add a versioned `edition.json` for the current curated bundle, generated
   from disk and normalized records.
3. Add an append-only change ledger connecting generation, automated repair,
   human review, and publication events.
4. Backfill an edition manifest for every assumed generated bundle.

**Acceptance criteria.**

- Generation manifests never change after freeze.
- Every published file appears exactly once in the edition inventory with
  current hash and media type.
- Every edition source and evidence edge resolves; zero missing-file, hash,
  byte, or count discrepancies.
- A verifier reproduces the entire report deterministically in CI.

### R-06 — Make legal quality gates executable

**State: PENDING**

**Problem.** The reviewer prompt contains valuable instructions, but merge
authority is not coupled to deterministic legal, evidence, manifest, or corpus
gates. An administrative merge can bypass the intended standard.

**Evidence.** The two-source rule exists inside a natural-language ACP prompt
at `main.py:1329-1350`. The site package has no `test` script
(`digest-law-us/package.json:8-18`). A full current-HEAD runner test and
coverage run at `265a8610695067d825392751ffdb3e5932a0aefd` produced 4,762
failures and 3,411 passes across 8,173 tests; 455 of 469 failing files were
per-PR adversarial files. Coverage was 51.73% lines/statements and 43.86%
branches, 49.65% combined.

**Cause.** Quality policy is split among prompts, historical per-PR tests,
corpus linters, and reviewer discretion. There is no single release predicate.

**Remediation.**

1. Define a machine-readable release policy with structural, provenance,
   evidence, legal-review, licensing, and publication gates.
2. Replace obsolete per-PR path fixtures with invariant contract tests plus a
   small, versioned set of substantive legal gold cases.
3. Require the release verifier as a protected-branch check; disallow bypass
   except a logged two-person emergency procedure.
4. Treat model review as triage, never as the final proof of correctness.

**Acceptance criteria.**

- Main is green under a documented current test set.
- Required checks cannot be skipped by the ordinary merge path.
- Every corpus release records the verifier version and its signed result.
- A deliberately corrupted source association, citation, manifest, and SKOS
  relation each causes a release failure.

### R-07 — Separate generated text from curated canonical editions

**State: PENDING**

**Problem.** The generated Markdown currently plays three roles: model output,
editorial canonical text, and public page. Editing it destroys the distinction
between what the machine produced and what a curator approved.

**Evidence.** The worker writes the report directly to
`topic.main_digest_path` at
`runner/run_key_digest_research_workers.py:1362-1412`; the site reads that file
directly through `src/content.config.ts:51-66`.

**Cause.** There is no edition or editorial state model between generation and
publication.

**Remediation.**

1. Store raw generation, normalized draft, reviewed edition, and published
   edition as distinct immutable revisions.
2. Attach reviewer identity, expertise, change set, disposition, and date to
   each promotion.
3. Publish only `reviewed` or `validated` editions; expose draft status where
   research access is useful.
4. Use structured content blocks or a claim graph as the source of the rendered
   Markdown.

**Acceptance criteria.**

- Any public paragraph can be traced to its raw generation and review history.
- Regeneration cannot overwrite reviewed content.
- Promotion and rollback are metadata operations over immutable revisions.
- Public status cannot be inferred from “file exists”; it is explicit.

### R-08 — Replace path identity with stable concept identity

**State: PENDING**

**Problem.** The runner has UUID issue IDs, but public concept IRIs are derived
from the current hierarchical path. Reparenting or relabeling therefore changes
the public identifier.

**Evidence.**

- The runner explicitly treats `issue_id` only as provenance and derives the
  URN from notation/path: `key_digest/skos_okf.py:140-151`.
- The site mints `https://w3id.org/digest-law/us/{slugPath}/`:
  `digest-law-us/src/lib/skos.ts:22-24`.

**Cause.** Human browse location and concept identity are collapsed into one
URL.

**Remediation.**

1. Mint `https://w3id.org/digest-law/concept/{opaque-public-id}` from immutable
   issue identity. Jurisdiction belongs in scope and scheme membership, not in
   the permanent concept path.
2. Keep readable paths as edition-specific aliases and page routes.
3. Publish permanent redirects and a path-history registry for every existing
   path.
4. Use identity IRIs in all relationships; never reconstruct a target IRI from
   a label or path.

**Acceptance criteria.**

- Changing preferred label or any parent leaves the concept IRI unchanged.
- Every legacy path resolves to the current concept or an explicit deprecated
  record.
- A uniqueness test proves one active concept per public ID and one current
  route per edition.

### R-09 — Build the graph the digest needs

**State: PENDING**

**Problem.** The current output is overwhelmingly a single-parent tree with
very few associative or external mappings. A professional digest needs
polyhierarchy, related issues, cross-references, and scope control.

**Evidence from the 1,705-digest measured checkout.**

- 1,704 digests have a `broader` value, but zero have more than one.
- Only one digest has an explicit `narrower` value.
- 159 digests have any `related` value.
- 135 have any domain-specific legal relation.
- Only eight have a West 1914 mapping; none has a SALI/LMSS, LIST, or EuroVoc
  value.

**Cause.** The generator fills a structural parent automatically
(`key_digest/skos_okf.py:91-96`) and emits empty relationship/mapping slots by
default. No graph curation program follows generation.

**Remediation.**

1. Create a 600-ish evidence-backed professional Topic Entry Layer.
2. Type concepts as topic, issue, doctrine/test, statutory regime, authority,
   controversy collection, or scaffold.
3. Add multiple broader paths where warranted and conservative `related`
   relations with typed editorial reasons.
4. Merge or deprecate scaffolding and false issue nodes without deleting
   identifiers.
5. Build separately reviewed mappings to FOLIO, LCC/LCSH, EuroVoc, SALI/LMSS,
   and other jurisdiction-appropriate schemes.

**Acceptance criteria.**

- All concepts have an adjudicated concept type.
- Scaffold nodes cannot be published as legal issues.
- Multiple placement and associative links pass reciprocal/integrity checks.
- Mapping relations include target snapshot, relation type, provenance,
  confidence, and reviewer.

### R-10 — Add authority updating and treatment as a separate citator track

**State: PENDING**

**Problem.** The direct issue-layer comparators are the West Topic and Key
Number digests and LexisNexis headnotes. The citator comparators are KeyCite
and Shepard's. The project can compete with the issue layer only if it
classifies issues rigorously; it cannot compete with citators without citation
history, treatment, and current-validity services. Those are different
products.

**Evidence.** Current bundles contain derived case/statutory indexes, but no
normalized authority graph, subsequent-history graph, negative-treatment
model, jurisdiction/date validity engine, or update service.

**Cause.** v3 was designed for one-time issue research and publication, not
continuous citator maintenance.

**Remediation.**

1. Normalize cases, statutes, regulations, rules, and secondary sources into
   authority records.
2. Ingest official dockets/opinions and positive-law versions continuously.
3. Extract and adjudicate citation edges and treatment signals.
4. Keep treatment evidence separate from issue classification.
5. Display freshness, jurisdiction, court, precedential status, and update
   coverage honestly.

**Acceptance criteria.**

- Every authority has a canonical identifier and source provenance.
- Treatment assertions link to the exact citing passage and are reviewer
  traceable.
- Known negative-treatment and amendment benchmark sets meet published
  precision/recall thresholds.
- A stale update feed makes affected validity displays fail closed.

### R-11 — Establish source-rights and redistribution control

**State: PENDING**

**Problem.** “Free to read” does not necessarily mean “lawful to redistribute
in full.” The public site currently serves retained source text, while the
source record lacks a mandatory, reviewed rights basis.

**Evidence.** `digest-law-us/README.md:70-84` says the private corpus is loaded
and describes retained sources as public domain or as licensed, but the source
loader schema has no required license, rights holder, jurisdiction, or
redistribution field (`src/loaders/sources.ts`; `src/content.config.ts` source
schema). All 7,436 measured source frontmatter records lack license, rights,
copyright, named provenance, and language; only eight declare jurisdiction.
The store has 1,090 duplicate body copies and 526,940,196 reclaimable body
bytes (32.67%).

**Cause.** Retrieval availability and redistribution rights are conflated.

**Remediation.**

1. Add source-level rights basis, license identifier, rights holder,
   acquisition method, and redistribution disposition.
2. Separate sources usable for internal research from sources publishable in
   full.
3. Publish links and compliant excerpts when full-text redistribution is not
   authorized.
4. Obtain counsel review for the release policy and for structural influence
   from restricted inputs.
5. Store each source body once and model issue-specific occurrences
   separately.
6. Add an independent privacy/sensitivity/redaction disposition for filings
   and records containing personal or confidential information.

**Acceptance criteria.**

- Every public source object has a machine-readable reviewed disposition.
- Every public source object also has a privacy/sensitivity disposition.
- Build fails if a full-text page lacks permission to redistribute.
- PD-only and broader research editions can be generated without hidden
  cross-contamination.

### R-12 — Replace the all-static publishing topology at completed scale

**State: PENDING**

**Problem.** The current Astro build is already large at 1,705 digests. It
cannot be assumed to scale to 137,139 generated bundles.

**Evidence.**

- The repository instructions record about 20,900 pages, 29,667 files, 1.8 GB
  output, a 12 GB Node heap, and about 27 minutes for the current build.
- The package rebuilds the entire site and Pagefind index:
  `package.json:8-18`.
- CI allows only three minutes and does not obtain the private corpus:
  `.github/workflows/ci.yml:15-46`.

**Cause.** Every digest and retained-source chunk is rendered in one monolithic
static build, while code and corpus live in separate repositories without a
versioned release artifact.

**Remediation.**

1. Publish a versioned corpus database/object set independent of the UI build.
2. Precompute graph and search indexes incrementally.
3. Use dynamic or partitioned rendering with immutable cached issue/source
   objects.
4. Make CI test a pinned representative corpus fixture; run release-scale
   validation in a separately budgeted pipeline.

**Acceptance criteria.**

- Updating one digest does not rebuild unrelated issue pages.
- A release of all 137,139 assumed bundles completes within an explicit time,
  memory, file-count, and cost budget.
- Code CI is reproducible without a private sibling checkout.
- Search and dereferencing remain available during reindexing.

## Good-to-have proposals

### G-01 — Restore section-level synthesis as an optional research view

**State: PENDING**

Generate section reports only when they improve claim coverage or specialist
review. The code still supports `synthesis_mode == "sections"` at
`runner/run_key_digest_research_workers.py:1430-1444`, but current production
uses the single-report mode. Accept when a controlled evaluation shows better
legal coverage without lowering grounding.

### G-02 — Add active-learning review queues

**State: PENDING**

Prioritize lawyer time by predicted severity, weak grounding, off-topic risk,
mapping uncertainty, doctrinal centrality, and user traffic. Accept when queue
priority is demonstrably better than random sampling while preserving a random
audit stream.

### G-03 — Provide reproducible local research packs

**State: PENDING**

Package a digest edition, permitted sources, claims, and validation report as a
portable archive. Accept when the pack can be verified offline from a signed
manifest.

### G-04 — Add usage-informed editorial signals

**State: PENDING**

Collect privacy-preserving failed searches, unresolved referrals, and adjacent
topic browsing to inform synonyms and relationships. User behavior may propose
changes but may never publish them without editorial review.

## Brownfield execution order

| Gate           | State   | Required outcome                                                          |
| -------------- | ------- | ------------------------------------------------------------------------- |
| 0. Freeze      | PENDING | Immutable complete-corpus snapshot and reproducible inventory             |
| 1. Integrity   | PENDING | Source association fixed; edition manifests reconcile                     |
| 2. Safety      | PENDING | Rights disposition, topical relevance, and unsupported claims quarantined |
| 3. Evaluation  | PENDING | Lawyer gold set, error typology, and release thresholds                   |
| 4. Identity    | PENDING | UUID-based concept IRIs plus legacy aliases                               |
| 5. Taxonomy    | PENDING | Concept typing, topic-entry layer, polyhierarchy, relations, mappings     |
| 6. Editorial   | PENDING | Reviewed/validated editions promoted without altering raw generations     |
| 7. Publication | PENDING | Completed-scale serving, search, CI, and monitoring                       |
| 8. Citator     | PENDING | Authority history and treatment product built and benchmarked separately  |

No later gate turns an earlier failure into DONE. In particular, publication
engineering cannot compensate for unsupported legal claims, and a strong
digest taxonomy does not by itself create a citator.
