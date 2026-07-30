# Research Method Audit — All 137,139 Digests Generated — 2026-07-29

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
>
> **Verification:** re-verified against code on 2026-07-30 — see the
> [verification addendum](../2026-07-30-verification-addendum.md) for
> confirmations, corrections, and drift (the pinned site commit no longer
> resolves after a history squash).

## Executive verdict

The implemented system is a strong **generation and publication prototype**:
it has canonical issue records, stable internal UUIDs, source retention,
specialized probes, deterministic index rendering, audit files, run manifests,
OKF hygiene, W3ID publication, and a usable public site.

It is not yet evidence of a professional-grade legal digest. The largest gap is
not formatting or Linked Data. It is the absence of a validated chain from:

> legal issue → appropriate sources → supported propositions → correct and
> current legal synthesis → conservative expert approval.

Under this document's scenario, all 137,139 current-format bundles exist for
the candidate research units in the v3 ledger. That removes generation
throughput as the central problem and makes corpus preservation, validation,
remediation, editorial governance, and continuous updating the central
program.

The West Topic and Key Number digests and LexisNexis headnotes are the closer
issue-classification comparators. KeyCite and Shepard's are citators. To
compete with the combined professional workflow, this project needs both a
high-quality open digest and a separately designed authority-treatment service.

## Status rule

- **DONE** means implemented and supported by repository evidence or a named
  measurement.
- **PENDING** means absent, not enforced, not measured, or below the required
  quality threshold.

No blended status is used. A control with completed and missing pieces is split
into atomic rows.

## Audit basis

### Repositories and snapshot

| Item                                    | Value                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| Runner commit inspected                 | `265a8610695067d825392751ffdb3e5932a0aefd`                         |
| Inspection date                         | 2026-07-29                                                         |
| Public site repository                  | `digest-law-us` current checkout on 2026-07-29                     |
| Scenario corpus                         | 137,139 current-format bundles, assumed complete                   |
| Measured corpus                         | 1,705 digest files                                                 |
| Measured manifests                      | 1,636                                                              |
| Measured digests without manifests      | 69                                                                 |
| Measured retained source Markdown files | 7,436                                                              |
| Measured top-level directories          | 41                                                                 |
| v3 issue ledger                         | 137,139 issue records from 156,802 item rows                       |
| v3 merge profile                        | 1,607 merged issues; 10,177 multi-item issues; maximum 271 members |
| v3 FOLIO area anchors                   | 104,572 `R*` identifiers; 32,567 local `x-digest-*` identifiers    |
| v3 FOLIO objective anchors              | 137,139 `R*` identifiers                                           |
| Measured digest schema versions         | 1,430 at 0.1.0; 243 at 0.1.1; 28 at 0.2.0; 1 at 0.2.1; 3 missing   |

The measured checkout differs from older documentation that says 42 roots or
1,621 digests. Its 41 roots comprise 31 current doctrinal roots and 10 legacy
composite roots. Five of the 36 v3 areas are absent from the measured physical
tree; retaining every legacy root while adding every v3 root would expose 46
roots. This audit uses the fresh 2026-07-29 scan.

### Limitations

**DONE**

- Code paths, checked-in manifests, frontmatter, documentation, and current
  site architecture were inspected.
- Corpus-wide structural/frontmatter and manifest scans were run over the
  measured checkout.
- The existing 40-bundle model-judge report was considered as a diagnostic.

**PENDING**

- The assumed complete 137,139-bundle snapshot was not available to count
  source bytes, defects, or field coverage.
- No new lawyer gold-set adjudication was performed.
- No blind comparison against proprietary systems was performed.
- No current full-suite passing baseline exists.

### Current-format generation profile

The most recent 14 measured bundles are the best available sample of the format
that the all-generated scenario assumes. They are a descriptive process
diagnostic, not a random sample and not an accuracy estimate.

| Measure                                      |                            Result |
| -------------------------------------------- | --------------------------------: |
| Bundles                                      |                                14 |
| Retained sources                             |                               131 |
| Sources per bundle                           | minimum 3; mean 9.357; maximum 21 |
| Bundles with at least two sources            |                                14 |
| Dedicated `definition`                       |                                 3 |
| Dedicated `scope_note`                       |                                 3 |
| `alt_labels`                                 |                                 1 |
| `related` / `narrower` / multiple `broader`  |                         0 / 0 / 0 |
| Typed legal relations                        |                                 0 |
| FOLIO mapping group                          |                                13 |
| Other external mapping group                 |                                 0 |
| Recorded runner version                      |                     14 at `0.4.0` |
| Distinct Markdown HTTP links in digest prose |                                75 |
| Links exactly matching a retained source URL |                          63 (84%) |
| Bundles with at least one Markdown HTTP link |                                 8 |

Across those eight linked bundles, 63 of the 75 distinct Markdown URLs (84%)
exactly matched a retained source URL; the other 12 links resolve to nothing in
the retained store. One 10-source bundle had no inline Markdown link. This URL
match is a grounding proxy only: it does not show that a source supports a
proposition, that the proposition is legally correct, or that omitted authority
was found.

### Current source-store profile

| Measure                              |                                Result |
| ------------------------------------ | ------------------------------------: |
| Source files                         |                                 7,436 |
| Unique `resource` URLs               |                                 6,185 |
| Files without `resource`             |                                   113 |
| Extra URL copies                     |        1,138 across 458 repeated URLs |
| Unique source bodies                 |                                 6,346 |
| Duplicate body copies                |                                 1,090 |
| Reclaimable duplicate body bytes     | 526,940,196 of 1,612,932,206 (32.67%) |
| Source records with `license`        |                                     0 |
| Source records with `rights`         |                                     0 |
| Source records with `copyright`      |                                     0 |
| Source records with named provenance |                                     0 |
| Source records with `language`       |                                     0 |
| Source records with `jurisdiction`   |                                     8 |

Only three files are whole-file hash duplicates because repeated bodies carry
different frontmatter. The most repeated URL is one CourtListener RECAP
declaration PDF copied into 64 unrelated issue directories. This shows why the
new architecture must store a source object once and connect it to issue
occurrences, rather than treating every bundle-local copy as an independent
source.

## Atomic controls already implemented

| ID   | State | Control                                                                                                                                                       | Evidence                                                              |
| ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| C-01 | DONE  | Canonical issue derivation preserves item IDs and fails on missing identity/path data.                                                                        | `key_digest/build_issues_v3.py`                                       |
| C-02 | DONE  | CourtListener, GovInfo, and eCFR are independently probed and errors are retained.                                                                            | `runner/legal_probe.py`                                               |
| C-03 | DONE  | GovInfo content URLs are fetched instead of application shells.                                                                                               | Current `ProbeHit.fetch_url` path and runner `docs/TODO.md` item 2    |
| C-04 | DONE  | Non-legal denylisted hosts are refused.                                                                                                                       | `runner/source_classify.py:400-415`                                   |
| C-05 | DONE  | Bodies shorter than 200 characters are refused.                                                                                                               | `runner/source_classify.py:415-421`                                   |
| C-06 | DONE  | Rejection reason and origin are recorded in generated evidence data.                                                                                          | `runner/run_key_digest_research_workers.py:1289-1347`                 |
| C-07 | DONE  | Caselaw and statutory indexes are deterministically rendered.                                                                                                 | `runner/render_indexes.py`                                            |
| C-08 | DONE  | Empty evidence buckets receive documented-absence output.                                                                                                     | Index renderers and `_render_sources_absence_marker()`                |
| C-09 | DONE  | Generation manifests include configuration, probes, evidence, and hashes for current-`SaveRecord` files; this is not a complete post-rerun edition inventory. | `runner/run_manifest.py`                                              |
| C-10 | DONE  | Markdown passes one normalization/lint path before write.                                                                                                     | `_write_okf_markdown()`                                               |
| C-11 | DONE  | A corpus repair pass removed thousands of known OKF defects.                                                                                                  | Runner `CHANGELOG.md`, 2026-07-28/29 entries                          |
| C-12 | DONE  | Reviewer instructions contain a two-on-disk-source minimum.                                                                                                   | `main.py:1329-1350`                                                   |
| C-13 | DONE  | Thin bundles with at most one source were purged from the then-current corpus.                                                                                | `docs/2026-07-28-purge-le1-manifest.tsv`; 993 bundles                 |
| C-14 | DONE  | Public pages disclose pre-provenance status rather than inventing missing data.                                                                               | `digest-law-us/src/pages/methodology.astro` and provenance components |

These controls make the system auditable. They do not establish that a source
is on topic, that a proposition is supported, or that the legal conclusion is
correct.

## Findings and root causes

### F-01 — Substantive legal accuracy has not been validated

**State: PENDING**

**Problem.** There is no lawyer-adjudicated gold set measuring correctness of
issue assignments, rule statements, exceptions, jurisdiction, temporal
validity, or source support.

**Evidence.**

- The existing evaluation is an LLM judge over 40 bundles.
- Its current-stage scores were 3.4/10 citation support, 5.2 legal quality,
  4.4 usefulness, and 4.1 overall.
- The prior sustained stage scored higher on every axis (5.3/5.8/5.1/5.2):
  the current stage is a measured regression, which the runner changelog
  attributes to prioritizing source acquisition (proxy pools) over honesty
  and consistency infrastructure.
- Model confidence in generation records is not external accuracy.

**Cause.** Funding and engineering prioritized corpus generation, provenance,
and publishing before specialist adjudication.

**Required remediation.** Execute the evaluation program below before
describing the complete corpus as authoritative, comprehensive, or competitive.

**Acceptance criteria.**

- Published legal accuracy, claim-support, issue-fit, and severity metrics from
  independent competent reviewers.
- Zero critical errors in the release gate sample.
- Error bounds and sample construction disclosed.

### F-02 — The research unit may be a heading or scaffold rather than an issue

**State: PENDING**

**Problem.** Current generation assumes a canonical issue record is a valid
substantive legal issue. Prefixes and inherited headings can instead represent
topics, scopes, introductions, forms, historical notes, or source-specific
organization.

**Evidence.**

- Nearly every measured main file has the same `legal_issue` type.
- Concept kinds are absent.
- The original method began with historical heading paths and prefix
  materialization.

**Cause.** Deduplication normalized identity among input records but did not
perform a separate issue-versus-scaffold adjudication.

**Required remediation.** Type every record and quarantine scaffold/error
classes from validated issue publication.

**Acceptance criteria.**

- 100% of validated concepts have an adjudicated kind.
- Issue precision is at least 98% on a held-out lawyer/librarian set.
- Rejected headings remain traceable to their source occurrences.

### F-03 — Source metadata can attach to the wrong retained file

**State: PENDING**

**Problem.** After the retention loop skips an item, the compacted saved-file
list is positionally paired with the unfiltered source-document list.

**Evidence.**

- Filtered save loop: `runner/run_key_digest_research_workers.py:1289-1313`.
- Unfiltered positional classification:
  `runner/run_key_digest_research_workers.py:1152-1182`.

**Cause.** Parallel lists are used instead of an identity-bearing source
decision record.

**Impact.** Source kind, URL, filename, indexes, profile, audit, and manifest can
disagree. Under the all-generated assumption, every bundle produced by this
path requires reconciliation.

**Required remediation.** Implement one retained-source object and rebuild
edition evidence from source IDs.

**Acceptance criteria.**

- Accepted–rejected–accepted tests preserve exact associations.
- Corpus reconciliation finds zero ambiguous or orphaned source edges.

### F-04 — Topical relevance is not gated

**State: PENDING**

**Problem.** A text can be genuinely legal and still be unrelated to the issue.

**Evidence.**

- The code explicitly says “Nothing here judges topicality”:
  `runner/source_classify.py:400-410`.
- Production examples include restaurant results for “accord” and a tax
  regulation for adverse possession.
- Lexical overlap and raw legal-language density were tested and shown to be
  unsafe as single-factor gates.
- The current-format
  `Insurance_Law/INSURANCE_CONTRACTS_AND_POLICIES/FORFEITURE_AND_REINSTATEMENT/AGENT_DUTIES_AND_LIABILITIES/FAILURE_TO_ENFORCE_FORFEITURE`
  bundle retains an unrelated 50 CFR forfeiture/remission document, a 31 CFR
  `[Reserved]` section, and an unrelated medical-device law-firm article.
- That bundle labels a Studicata brief as caselaw and a California code page as
  secondary material. Domain-wide `_DOMAIN_KINDS` rules classify
  CourtListener and `uscourts.gov` material as caselaw without determining
  whether the document is an opinion, order, brief, declaration, or another
  filing.

**Cause.** Labels are too short and ambiguous; no scope-note-based,
jurisdiction-aware, lawyer-calibrated relevance model exists. The retention
gate deliberately excludes topicality, and source type is inferred too
coarsely from host/domain rather than document type.

**Required remediation.** Build a labeled relevance benchmark and a
high-precision decision pipeline with explicit uncertain review.

**Acceptance criteria.**

- At least 98% retained-source precision and 95% primary-authority recall on a
  held-out specialist set.
- No critical off-topic primary authority in the release sample.

### F-05 — Sources are bundle-level, not claim-level evidence

**State: PENDING**

**Problem.** A two-source minimum does not demonstrate that material legal
propositions are supported.

**Evidence.**

- Reviewer policy counts files, not supported claims.
- `run.json` inventories source objects and buckets but no proposition/span
  links.
- Citation-support score remains the weakest current-stage judge dimension.
- The current-format forfeiture exemplar has 10 retained sources and no inline
  Markdown source link, demonstrating that source count alone does not produce
  a reviewable claim-to-evidence chain.

**Cause.** The synthesis format is prose-first. Evidence attribution is not a
first-class data model.

**Required remediation.** Segment legal claims and bind each to exact evidence
spans, authority identity, jurisdiction, and support kind.

**Acceptance criteria.**

- 100% of published material legal claims have resolvable source spans.
- Editorial synthesis links supported premises and is explicitly typed as an
  inference; it is never an exemption from evidentiary support.
- Unsupported leads and open questions remain quarantined from public legal
  propositions.
- Lawyer-audited claim support reaches at least 99%, with zero critical
  unsupported rules.

### F-06 — Manifest integrity does not survive editorial remediation

**State: PENDING**

**Problem.** Generation manifests no longer describe the mutable directory
reliably.

**Evidence from a fresh 1,636-manifest scan.**

The 1,636 manifests contain 13,020 inventory entries: 12,309 absolute paths
and 711 relative paths. This is a portability defect in addition to the
content-integrity failures below.

| Integrity failure                              | Bundles | Entries/files |
| ---------------------------------------------- | ------: | ------------: |
| Manifest inventory names missing file          |      26 |            48 |
| SHA-256 mismatch                               |      69 |           130 |
| Byte-count mismatch                            |      62 |           121 |
| On-disk source absent from manifest inventory  |     169 |           855 |
| `run.retained_sources` differs from disk       |     154 |             — |
| Declared evidence count differs from disk      |     166 |             — |
| Evidence-list length differs from disk         |     169 |             — |
| Evidence filename names missing file           |      24 |            44 |
| On-disk source absent from evidence sources    |     201 |           995 |
| Manifest source filename set differs from disk |     172 |             — |

**Cause.**

- Remediation changes files after generation.
- `build_manifest()` inventories only files written by the current
  `SaveRecord` list, so a rerun can leave pre-existing source files outside the
  new inventory.
- The repair tool refreshes existing inventory hashes but does not reconstruct
  the complete evidence state.
- Immutable generation provenance and mutable edition integrity are one object.

**Required remediation.** Freeze `run.json`; generate a separate current
edition manifest and change ledger.

**Acceptance criteria.** Zero missing, extra, mismatched, or unresolved
edition-manifest entries.

### F-07 — Runner version provenance is misleading

**State: PENDING**

**Problem.** The configured compose image is tagged 0.4.17, but the worker
constant remains `RUNNER_VERSION = "0.4.0"` and current manifests record only
0.4.0/0.4.1. The inspection did not establish which image is deployed.

**Evidence.**

- Constant: `runner/run_key_digest_research_workers.py:57`.
- Configured Compose image tag: `docker-compose.yml:95-100`.
- Measured manifest versions: 89 at 0.4.0 and 1,547 at 0.4.1.

**Cause.** Image/version labels and semantic behavior version are maintained in
different places.

**Required remediation.** Generate version identity from one build artifact and
record code commit, image digest, schema version, prompt hash, and behavior
feature set.

**Acceptance criteria.** A manifest unambiguously identifies the exact runnable
code and container image that produced it.

### F-08 — “Preserved in full” is not true for every probe source

**State: PENDING**

**Problem.** Public methodology says accepted texts are preserved in full, but
probe fetching truncates normalized text to 60,000 characters.

**Evidence.** `_PROBE_DOC_CHARS = 60_000` and slicing in
`runner/legal_probe.py:723-810`.

**Cause.** A bounded context was chosen for model and storage safety, while the
public language described full-document preservation.

**Required remediation.**

- Preserve original permitted bytes separately.
- Derive bounded research excerpts with explicit span metadata.
- Correct the public methodology until full preservation is guaranteed.

**Acceptance criteria.** “Full” is used only where the stored hash covers the
complete acquired representation; excerpts disclose boundaries.

### F-09 — eCFR search works but authoritative text acquisition is not complete

**State: PENDING**

**Problem.** The dedicated eCFR probe rejects the bot interstitial, but the
ordinary search/curation path can still retain an eCFR page or an off-topic CFR
section. The authoritative version API and one common regulatory relevance
policy are not implemented.

**Evidence.** Runner `docs/TODO.md`, item 2; blocked-page logic in
`runner/source_classify.py` and `runner/legal_probe.py`; the current-format
forfeiture exemplar retained 50 CFR forfeiture/remission and a 31 CFR
`[Reserved]` result through ordinary curation.

**Cause.** The dedicated probe and ordinary research path apply different
acquisition and acceptance policies, and the implementation does not use the
developer versioner API for exact section content.

**Required remediation.** Retrieve exact eCFR title/part/section versions
through the official API and retain version/effective-date metadata.

**Acceptance criteria.**

- eCFR hits resolve to section text and version metadata.
- No CAPTCHA/interstitial counts as authority.
- CFR title/issue fit passes the relevance benchmark.

### F-10 — Document-length thresholds are inconsistent

**State: PENDING**

**Problem.** Probe text below 1,500 characters is refused while curated text at
200 characters is allowed.

**Evidence.** `_MIN_DOC_CHARS = 1500` in `runner/legal_probe.py`;
`_MIN_RETAINED_CHARS = 200` in `runner/source_classify.py`.

**Cause.** Shell detection and general retention evolved in separate modules
without one calibrated source policy.

**Required remediation.** Use content-type/source-type-specific validity rules
calibrated on labeled short primary-law documents.

**Acceptance criteria.** The same source representation receives the same
decision regardless of acquisition path.

### F-11 — Re-running research can destroy reviewed content

**State: PENDING**

**Problem.** New runs overwrite topic directories.

**Evidence.** Historical analysis found 985 of 3,010 directories written by
more than one research commit and confirmed a review repair later clobbered
(`docs/TODO.md`, item 7).

**Cause.** The filesystem path is the generation target and canonical edition;
there is no immutable revision/promotion model.

**Required remediation.** Write every run as an immutable revision and promote
reviewed editions by pointer.

**Acceptance criteria.** Regeneration cannot change reviewed bytes or aliases
without an explicit reviewed edition event.

### F-12 — The test suite cannot currently prove regressions

**State: PENDING**

**Problem.** The current-HEAD runner suite result was 4,762 failures and 3,411
passes across 8,173 tests, mostly per-PR tests referencing changed or purged
paths. The site has no test script.

**Evidence.**

- Full runner test and coverage run at
  `265a8610695067d825392751ffdb3e5932a0aefd`: 469 distinct failing files,
  455 per-PR adversarial; 8,398 `FileNotFoundError` occurrences and 1,112
  `AssertionError` occurrences; 51.73% line/statement, 43.86% branch, and
  49.65% combined coverage.
- `digest-law-us/package.json:8-18`.
- Site CI has a three-minute build timeout and no corpus acquisition step:
  `.github/workflows/ci.yml:15-46`.
- Current site checks also fail: `npm run check` exits 134 at about the default
  4 GB heap because that script lacks the build's 12 GB wrapper; lint has one
  `no-console` error at `src/lib/corpus.ts:90`; formatting reports 24 files.

**Cause.** One-off remediation tests accumulated as permanent corpus fixtures,
while corpus churn invalidated their paths. The site inherited template CI.

**Required remediation.**

- Preserve only high-value substantive gold cases.
- Replace historical path pins with invariant property tests and release
  validators.
- Add site unit, integration, accessibility, RDF, route, and smoke tests.

**Acceptance criteria.**

- Main is green.
- Critical runner logic reaches at least 90% lines and 85% branches.
- New site modules reach at least 80% lines and 70% branches.
- Deliberate evidence, identity, and graph corruptions are caught.

### F-13 — Source redistribution rights are not enforced

**State: PENDING**

**Problem.** The site serves source text, but source records do not require a
reviewed rights basis.

**Evidence.** The public README claims retained sources are public domain or
as-licensed, while the content/source schemas do not require license,
rights-holder, or redistribution disposition. Of 7,436 measured source files,
zero declare `license`, `rights`, `copyright`, named provenance, or language;
only eight declare jurisdiction.

**Cause.** Open-web accessibility was used as a proxy for legal reuse.

**Required remediation.**

- Add counsel-reviewed rights metadata and separate internal-research use from
  full-text publication.
- Add a distinct privacy/sensitivity disposition for filings and other records
  that may expose personal or confidential information. A source can be lawful
  to access and still be inappropriate to republish in full.

**Acceptance criteria.** No source text publishes without machine-enforced
redistribution and privacy/sensitivity dispositions.

### F-14 — The taxonomy is structurally sparse

**State: PENDING**

**Problem.** The measured graph has no polyhierarchy and little associative
structure or crosswalking.

**Evidence.**

- Zero multi-broader concepts.
- 159 concepts with `related`.
- Eight West 1914 mappings; no populated SALI/LMSS, LIST, or EuroVoc mappings.
- Dedicated `definition` is present on 660 concepts; 1,633 have either
  dedicated `definition` or the legacy `description` fallback. A fallback
  improves display coverage but is not a substitute for an editorially scoped
  definition.
- Repeated-label counts expose unresolved scaffold and contextual-identity
  questions: `GENERAL PRINCIPLES` 246, `MEASURE OF DAMAGES` 114,
  `DEFINITION AND NATURE` 108, `IN GENERAL` 29, `CASE CITATION` 27, and
  `INTRODUCTION` 26.

**Cause.** Structural parent generation and empty mapping slots were
implemented; semantic curation was not.

**Required remediation.** Build the Topic Entry Layer, concept typing,
polyhierarchy, associative relations, language-keyed notes, and reviewed
mappings.

**Acceptance criteria.** See
[FOLIO/SKOS plan](2026-07-29-FOLIO_SKOS.md).

### F-15 — The publishing architecture does not scale to the assumed corpus

**State: PENDING**

**Problem.** One monolithic static build already requires a 12 GB heap and
about 27 minutes at 1,705 digests.

**Evidence.** `digest-law-us/AGENTS.md`; current build/deploy scripts.

**Cause.** The entire corpus, source chunks, and search index are generated in
one Astro build.

**Required remediation.** Use versioned data releases, incremental indexes, and
dynamic or partitioned rendering.

**Acceptance criteria.** Full 137,139-bundle performance, cost, and availability
budgets are measured and met.

### F-16 — The corpus is historical and U.S.-specific

**State: PENDING**

**Problem.** Generating every inherited issue does not prove coverage of modern
U.S. law or suitability for another jurisdiction/language.

**Evidence.** The underlying methodology was bootstrapped from historical U.S.
digest/treatise structure; current site language tags are hardcoded English.

**Cause.** Public-domain historical sources and a U.S.-first proof reduced cost
and licensing risk, but modern and jurisdiction-local editorial sources require
funding.

**Required remediation.**

- Measure modern-subject coverage against a defined benchmark.
- Add modern official/open sources.
- Build each new jurisdiction from its own professional vocabulary, sources,
  authority system, and specialists.

**Acceptance criteria.** Coverage statements name a denominator, jurisdiction,
time, source classes, and evaluated miss rate.

## Root-cause map

| Root cause                                                               | Downstream problems                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Filesystem path used as identity, arrangement, revision, and publication | IRI instability, overwrite loss, weak versioning                     |
| Bundle-level source presence used as evidence                            | Unsupported claims, low citation support, misleading two-source gate |
| Heading record treated as issue                                          | Scaffold contamination, overlarge issue universe, weak retrieval     |
| Parallel arrays instead of source IDs                                    | Misbound source metadata, wrong indexes/manifests                    |
| Prompt policy not executable policy                                      | Bypassable review and inconsistent releases                          |
| Generation prioritized over adjudication                                 | No legal accuracy estimate, no agreement metrics                     |
| One-time research model                                                  | No authority versioning, treatment, or current-law guarantee         |
| Open access treated as open redistribution                               | Licensing exposure                                                   |
| Static corpus tree used as graph                                         | No polyhierarchy, sparse associative relations                       |
| U.S./English constants embedded in code                                  | Poor international replication boundary                              |

## Evaluation Workstream 0

This is the first required funded milestone even though all digests are assumed
generated.

### E-01 — Freeze the evaluation population

**State: PENDING**

Create a signed manifest of the complete generated corpus and its generator
versions. No sample is valid without a fixed population.

### E-02 — Construct a 1,200-concept stratified issue sample

**State: PENDING**

Stratify across:

- Topic Entry Layer candidate/domain;
- path depth;
- concept kind prediction;
- source era;
- modern versus historical subject;
- source profile and source count;
- generator/image period;
- classifier confidence band;
- merged versus single-item issue;
- FOLIO mapped versus soft/unmapped;
- high-risk homonyms and scaffolds;
- jurisdictional/federal/state questions.

Keep a separately sampled random stream so risk-based selection does not hide
the base rate.

### E-03 — Construct claim and source samples

**State: PENDING**

From the sampled concepts, select:

- every major rule/element/exception claim;
- a random sample of lower-salience claims;
- every cited source edge;
- retained but uncited sources;
- every contrary/limiting proposition;
- all treatment/current-law assertions.

### E-04 — Review protocol

**State: PENDING**

Two reviewers independently adjudicate at least 400 concepts and their claims.
Reviewers record:

1. is this a substantive issue;
2. is the preferred label lawyer-usable;
3. is the scope correct;
4. are parent and related links correct;
5. is each source on topic and authoritative for the proposition;
6. does each evidence span support the claim;
7. is the synthesis legally correct;
8. are jurisdiction, posture, and temporal qualifications correct;
9. are material contrary authorities or exceptions omitted;
10. is the digest useful for a practicing lawyer;
11. what severity and error type applies.

Disagreement goes to a more senior adjudicator; it is not averaged away.

### E-05 — Reported measures

**State: PENDING**

Report with confidence intervals:

- issue precision;
- scaffold/noise rate;
- path and relationship accuracy;
- source topical precision and primary-law recall;
- claim support precision;
- legal correctness by claim severity;
- omission rate for controlling exceptions/contrary authority;
- current-law accuracy;
- citation/authority normalization accuracy;
- lawyer task success and time;
- inter-reviewer agreement;
- error rate by generator version, source profile, and subject.

### E-06 — Release thresholds

**State: PENDING**

Required minimums for the `validated` channel:

| Measure                                            |  Required threshold |
| -------------------------------------------------- | ------------------: |
| Critical unsupported or legally wrong propositions | 0 in release sample |
| Claim support                                      |                ≥99% |
| Overall substantive legal correctness              |                ≥98% |
| Issue-versus-scaffold precision                    |                ≥98% |
| Retained-source topical precision                  |                ≥98% |
| Primary-authority recall on benchmark questions    |                ≥95% |
| Authority normalization accuracy                   |                ≥99% |
| Hierarchy/mapping accuracy                         |                ≥95% |
| Reviewer agreement on categorical decisions (chance-corrected: Cohen's κ for two raters, Krippendorff's α otherwise — not raw percent agreement) | ≥0.80 |
| Structural/provenance/release-integrity failures   |                   0 |

Concepts failing a threshold remain `candidate` or `reviewed`; they are not
silently counted as validated.

Each percentage threshold is met only when the lower bound of its
pre-registered confidence interval clears the threshold, not when the point
estimate does. Observing zero critical errors in a sample of *n* bounds the
true critical-error rate only to roughly 3/*n* at 95% confidence (the rule of
three); size the release sample from the tolerable critical-error rate, not
from reviewer availability.

## Competitive evaluation

### Required

| Evaluation           | State   | Method                                                                                                                                      |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue retrieval      | PENDING | Blind lawyer questions; compare time-to-relevant authorities and recall against ordinary keyword search and available professional workflow |
| Digest usefulness    | PENDING | Lawyers perform research tasks without seeing system identity                                                                               |
| Taxonomy navigation  | PENDING | Lawyers and librarians locate target issues from broad topics                                                                               |
| Current-law validity | PENDING | Known amendments, overrulings, supersessions, and jurisdiction conflicts                                                                    |
| Transparency         | PENDING | Measure time to verify a proposition from attached evidence                                                                                 |
| Coverage             | PENDING | Use a declared benchmark universe; never “all ingested items classified”                                                                    |

Do not copy proprietary headnotes, key numbers, selection/arrangement, or
treatment labels. The competitive claim is that strict, conservative curation
can be replicated through public sources, auditable methods, and specialists.
The benchmark evaluates function and quality, not copied content.

## Disposition of the assumed completed corpus

| Channel                         | State   | Rule                                                                     |
| ------------------------------- | ------- | ------------------------------------------------------------------------ |
| `generated` under this scenario | DONE    | Machine output exists by assumption; not a quality or immutability claim |
| `candidate`                     | PENDING | Structural, rights, identity, and integrity gates pass                   |
| `reviewed`                      | PENDING | Named competent reviewer approves issue and digest                       |
| `validated`                     | PENDING | Gold-standard criteria and release thresholds pass                       |
| `deprecated`                    | PENDING | Identity remains; reason and replacement published                       |
| `disputed`                      | PENDING | Conflicting legal/editorial views are visible and routed                 |

The public UI must show the channel. “Generated” must not look visually or
linguistically identical to “validated.”

## Immediate conclusions

1. Generation completeness is an asset, not proof of correctness.
2. Preserve the completed output before modifying it.
3. Fix source identity and provenance reconciliation before trusting
   corpus-wide evidence statistics.
4. Evaluate legal quality before further marketing claims.
5. Separate generated and curated editions.
6. Build the issue graph and authority graph as distinct systems.
7. Treat citator parity as a separate, larger workstream.
8. Replicate the method through jurisdiction packages and local specialists,
   not by translating the U.S. taxonomy.

## Related all-generated documents

- [Runner proposals](2026-07-29-RUNNER_V3_PROPOSALS.md)
- [Architecture](2026-07-29-ARCHITECTURE_FOLIO_ALIGNED.md)
- [FOLIO and SKOS plan](2026-07-29-FOLIO_SKOS.md)
- [Atomic TODO](2026-07-29-TODO.md)

## Primary standards and comparator references

- W3C, [SKOS Simple Knowledge Organization System Reference](https://www.w3.org/TR/skos-reference/)
- W3C, [SKOS Primer](https://www.w3.org/TR/skos-primer/)
- W3C, [Shapes Constraint Language (SHACL)](https://www.w3.org/TR/shacl/)
- Thomson Reuters, [Westlaw editorial enhancements](https://legal.thomsonreuters.com/en/products/westlaw/editorial-enhancements)
- LexisNexis, [About Headnotes](https://supportcenter.lexisnexis.com/app/lexisplus/a_id/1094669/loc/en_US)
- LexisNexis,
  [Shepard's Report on Lexis+](https://supportcenter.lexisnexis.com/app/lexisplus/a_id/1125142)
- Cornell Legal Information Institute,
  [National Reporter System](https://www.law.cornell.edu/wex/national_reporter_system)
- Cornell Legal Information Institute,
  [Headnote](https://www.law.cornell.edu/wex/headnote)
- Gallacher,
  [Finding the Law: The Values, Identity, and Function of a Digest](https://scholarship.law.cornell.edu/ijli/vol36/iss1/4/)
