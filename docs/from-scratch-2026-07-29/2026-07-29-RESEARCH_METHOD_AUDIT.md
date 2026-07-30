# Research-method readiness audit — from-scratch program — 2026-07-29

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

## Executive conclusion

**Generation readiness: PENDING.**

This audit assumes that the new program has generated **zero digest articles
or releases**. That is the correct state: the current implementation proves
useful components and reveals material failure modes, but it does not yet
provide the contracts, benchmarks, human editorial system, source-rights
controls, or release integrity needed for a conservative competitor to a
professional digest.

The first funded output should be an evaluated method and gold set. Production
scale should begin only after the method clears predeclared gates.

## Status convention

- **DONE** — a discrete decision is closed, evidence has been collected, or a
  reusable component exists.
- **PENDING** — the greenfield program has not met a named acceptance test.

Every finding is divided into independently verifiable `DONE` or `PENDING`
actions.

## Audit scope and evidence

Audit date: **2026-07-29**.

Repositories examined:

- `key-digest-runner` at
  `265a8610695067d825392751ffdb3e5932a0aefd`;
- `digest-law-us` at the checked-out 2026-07-29 workspace state; and
- the existing runner method audit, TODO, LLM-judge assessment, corpus
  artifacts, generator, reviewer, and publisher.

Current-corpus observations are evidence about the method, not accepted
greenfield outputs:

- 1,705 digest-shaped bundles;
- 1,636 `run.json` manifests and 69 bundles without one;
- 7,436 source Markdown files;
- 41 top-level corpus directories: 31 current doctrinal roots and 10 legacy
  composite roots;
- about 1.6 GB in the OKF tree;
- 137,139 v3 issue records derived from 156,802 item rows, including 1,607
  merged issues and 10,177 issues with multiple member items;
- digest schema versions: 1,430 at 0.1.0, 243 at 0.1.1, 28 at 0.2.0, one at
  0.2.1, and three missing;
- 660 dedicated non-empty concept definitions, while 1,633 concepts (95.8%)
  have either `definition` or the legacy `description` fallback;
- 668 non-empty scope notes;
- 159 concepts with `related`;
- 135 concepts with populated project legal relations; and
- no parsed concept with more than one explicit `broader` relation.

The new program's generated-digest count remains **zero**.

The most recent 14 existing bundles illustrate the format that must not become
the greenfield acceptance oracle: 131 retained sources, three dedicated
definitions, three scope notes, one alternate-label set, no `related`,
`narrower`, multiple-`broader`, or typed legal relations, 13 FOLIO groups, and
no other external mappings. Eight of the 14 contain a Markdown HTTP link; 63 of
75 distinct links (84%) exactly match a retained resource URL. That is a useful
grounding proxy, not proof that a proposition is supported or legally correct.

The existing source store also shows why the greenfield data model must
separate source objects from occurrences: 7,436 files contain only 6,346 unique
bodies, leaving 1,090 duplicate body copies and 526,940,196 reclaimable bytes
(32.67% of source-body bytes). One CourtListener RECAP declaration URL is
copied into 64 unrelated issue directories. Of the 7,436 source frontmatter
records, zero declare license, rights, copyright, named provenance, or
language; only eight declare jurisdiction.

## Readiness matrix

| Area                                  | Status      | Release consequence                            |
| ------------------------------------- | ----------- | ---------------------------------------------- |
| Canonical issue definition and typing | **PENDING** | No issue may be scheduled                      |
| Stable identity and revision model    | **PENDING** | No public identifier may be minted             |
| Source identity through the pipeline  | **PENDING** | No evidence bundle may be accepted             |
| Primary-law acquisition               | **PENDING** | No doctrinal claim may be accepted             |
| Topical and jurisdictional relevance  | **PENDING** | No source may support a public claim           |
| Claim-to-evidence validation          | **PENDING** | No digest may be accepted                      |
| Human legal and library curation      | **PENDING** | No candidate may be published                  |
| Evaluation/gold set                   | **PENDING** | No quality or competitive claim may be made    |
| Rights and redistribution             | **PENDING** | No source text may be published                |
| Semantic graph and SKOS profile       | **PENDING** | No concept scheme may be released              |
| Multilingual/jurisdiction method      | **PENDING** | No international replication claim may be made |
| Immutable reproducible release        | **PENDING** | No production deployment may be promoted       |

## Critical findings

### F-01 — source identity can be corrupted after a rejection

**Severity: critical**  
**Finding status: DONE** — the defect and cause are identified.  
**Greenfield prevention status: PENDING**

**Evidence.** In
`key-digest-runner/runner/run_key_digest_research_workers.py`,
`save_research_output()` skips a rejected source when it creates saved
`SaveRecord`s. `classify_retained_sources()` later enumerates the original
uncompacted `source_documents` and assigns the compacted saved filenames by
position. A second latent misalignment compounds the first: the save loop
iterates `output.source_markdown` while classification iterates
`output.result.source_documents` — two different collections — so any length
divergence between them misbinds filenames even when no source is rejected.

**Cause.** Discovery records, fetched content, retained files, and
classification records are parallel arrays joined by list index rather than by
an immutable source-snapshot ID.

**Impact.** If source 1 is dropped, source 2's filename can be assigned to
source 1's URL/classification. This can contaminate evidence buckets, indexes,
frontmatter, manifests, and any claim-to-source audit.

**Required prevention.**

1. **PENDING** — define `source_record_id` and `source_snapshot_id`.
2. **PENDING** — carry the snapshot ID through discovery, fetch, retention,
   save, classification, claim evidence, manifest, and publication.
3. **PENDING** — remove index-based joins.
4. **PENDING** — add property-based tests for arbitrary source rejection and
   reordering.
5. **PENDING** — independently recompute all public source/file/hash bindings
   at release time.

**Acceptance.** Rejecting, reordering, or deduplicating any source leaves every
other source's identity, URL, content hash, filename, authority type, and claim
links unchanged.

### F-02 — public methodology and mechanical merge gate disagree

**Severity: critical**  
**Finding status: DONE**  
**Greenfield prevention status: PENDING**

**Evidence.**

- `digest-law-us/src/pages/methodology.astro` says merge is blocked unless at
  least two retained sources exist.
- `key-digest-runner/conejo_validate.sh` requires four artifact filenames,
  explicitly says `sources/` is not universal, checks only a corruption regex,
  and merges when those file checks pass.
- The primary autonomous reviewer in `main.py` is model-driven; neither path
  establishes qualified human legal adjudication.

**Cause.** Public policy, shell validation, model review, and merge permissions
evolved independently.

**Impact.** A well-formatted zero-source or legally incorrect digest can satisfy
the mechanical gate while the website states a stronger evidence policy.

**Required prevention.**

1. **PENDING** — express each public methodological promise as an executable
   release invariant.
2. **PENDING** — make one policy module govern generator, reviewer, CI,
   publisher, and methodology-page metrics.
3. **PENDING** — prohibit administrative bypass of legal/evidence gates in the
   ordinary release path.
4. **PENDING** — require human editorial decisions as signed data, not inferred
   from a merged PR.
5. **PENDING** — add a policy-parity test that fails when public prose and
   executable rules diverge.

**Acceptance.** Given the same release candidate, the API, CI, reviewer UI,
publisher, and public methodology compute the same eligibility result and
reasons.

### F-03 — source hygiene is not topical, jurisdictional, or temporal relevance

**Severity: critical**  
**Finding status: DONE**  
**Greenfield prevention status: PENDING**

**Evidence.**

- `runner/source_classify.py` states that `retention_gate()` does not judge
  topicality.
- The current audit records restaurant results caused by the word “accord.”
- The current TODO records a tax regulation retained for an
  adverse-possession issue.
- The LLM-judge assessment records English-law, Philippine, international, and
  unrelated materials presented under mismatched U.S. issues.
- The current-format forfeiture exemplar retains unrelated 50 CFR
  forfeiture/remission material, a 31 CFR `[Reserved]` section, and an
  unrelated medical-device law-firm article.
- That exemplar labels a Studicata brief as caselaw and a California code page
  as secondary material. Current domain-wide source-kind rules do not
  distinguish an opinion or order from a brief, declaration, or other filing.

**Cause.** High-precision host and document-length rules were available, but no
lawyer-labeled relevance set existed to calibrate semantic decisions. The
retention gate deliberately excludes topicality, and source kind is inferred
too coarsely from domain rather than document type.

**Impact.** An official legal source can pass every hygiene check and still
support the wrong doctrine.

**Required prevention.**

1. **PENDING** — build a stratified source-relevance gold set with hard
   negatives.
2. **PENDING** — separately label topical relevance, jurisdictional
   applicability, temporal applicability, authority status, and source
   quality.
3. **PENDING** — evaluate deterministic filters, retrieval/reranking models,
   and human review on a held-out set.
4. **PENDING** — expose rejected and borderline sources to reviewers.
5. **PENDING** — publish per-jurisdiction and per-source-type error rates.

**Acceptance.** Predeclared recall and precision thresholds are met on a held-
out lawyer-adjudicated set; no threshold is selected using the test set.

### F-04 — fluent prose can outrun retained authority

**Severity: critical**  
**Finding status: DONE**  
**Greenfield prevention status: PENDING**

**Evidence.** `docs/assessments/2026-07-28-llm-judge.md` reports, across 40
sampled historical bundles, long specific digests with zero or few retained
sources, unsupported case/statute claims, fabricated-looking recent
developments, doctrinal errors, and citation-support averages that remained
weak even when presentation improved. The same report shows the current stage
is a measured regression: the prior sustained stage scored higher on every
axis (5.3 citation support, 5.8 legal quality, 5.1 usefulness, 5.2 overall,
versus 3.4/5.2/4.4/4.1), and the runner changelog attributes the regression
to prioritizing source acquisition (proxy pools) over honesty and consistency
infrastructure.

**Cause.** The system generated an essay from a research result rather than
requiring atomic claims with verified evidence spans.

**Impact.** Polished structure increases the danger by making unsupported
analysis appear professionally edited.

**Required prevention.**

1. **PENDING** — make structured claims, not Markdown, the synthesis output.
2. **PENDING** — require a source snapshot and pinpoint evidence span for every
   non-trivial factual/doctrinal proposition.
3. **PENDING** — deterministically match quotations and citation targets.
4. **PENDING** — identify contrary, limiting, and superseding authority.
5. **PENDING** — prohibit full doctrinal prose when evidence sufficiency fails.
6. **PENDING** — require lawyer adjudication of claim support and correctness.
7. **PENDING** — type editorial synthesis as an inference over supported
   premises; never use “synthesis” or “open question” to exempt a material
   public legal proposition from evidence.

**Acceptance.** The held-out release sample has zero critical unsupported
claims after adjudication, and every accepted claim resolves to its evidence in
one action.

### F-05 — machine confidence and provenance do not measure legal accuracy

**Severity: critical**  
**Finding status: DONE**  
**Evaluation status: PENDING**

**Evidence.** Existing manifests record provider, prompt, timing, hashes, and
evidence buckets. The LLM-judge assessment still found material legal and
support errors. Historical “confidence” values were model self-reports.

**Cause.** Operational observability and substantive validation were treated as
adjacent quality signals.

**Impact.** A precisely documented wrong answer remains wrong.

**Required prevention.**

1. **PENDING** — remove model confidence from public accuracy claims.
2. **PENDING** — use confidence only for review routing after calibration.
3. **PENDING** — measure concept accuracy, source relevance, claim support,
   legal correctness, relationship correctness, and retrieval usefulness
   against human gold data.
4. **PENDING** — publish confidence calibration curves and subgroup error.

**Acceptance.** Every public quality claim names the human-labeled denominator,
sample, metric, uncertainty interval, and date.

### F-06 — “review” is not yet conservative professional curation

**Severity: critical**  
**Finding status: DONE**  
**Editorial system status: PENDING**

**Evidence.** Current merge paths are an autonomous ACP reviewer and a
deterministic shell validator. A PR merge proves workflow completion, not
reviewer qualification, independence, issue classification accuracy, or legal
correctness.

**Cause.** Human review was framed as a gate rather than an editorial protocol.

**Impact.** The method cannot reproduce the trust-generating feature of West
and Lexis: consistent conservative professional judgment.

**Required prevention.**

1. **PENDING** — define reviewer qualifications by jurisdiction and field.
2. **PENDING** — create issue, relation, source, claim, and authority rubrics.
3. **PENDING** — require independent dual review for the gold set and
   high-risk material.
4. **PENDING** — record disagreements and adjudication rationales.
5. **PENDING** — measure agreement, reviewer drift, correction rate, and
   severity.
6. **PENDING** — prevent self-approval and unmanaged conflicts.

**Acceptance.** Review data identifies who decided what, under which rubric,
against which evidence, with measured agreement and an appeal trail.

### F-07 — mutable bundle directories allow provenance drift and data loss

**Severity: critical**  
**Finding status: DONE**  
**Revision architecture status: PENDING**

**Evidence.**

- The current TODO records 985 of 3,010 historical topic directories written
  by more than one research commit.
- It documents a rerun replacing a richer repaired bundle with a frontmatter-
  only stub.
- The 2026-07-29 manifest audit found 48 missing inventory files across 26
  bundles, 130 SHA mismatches across 69, 121 byte mismatches across 62, 154
  retained-count mismatches, 855 disk files absent from inventories across 169,
  166 declared-evidence-count mismatches, 169 evidence-list-length mismatches,
  44 evidence filenames missing from disk across 24, 995 disk files absent
  from evidence records across 201, and source filename-set differences across
  172 bundles.
- The 13,020 manifest inventory entries use 12,309 absolute paths and only 711
  relative paths, so the stored manifests are not portable release artifacts.
- The tree has 1,705 digest bundles but only 1,636 manifests (69 absent).

**Cause.** A mutable folder represented both issue identity and current
revision; manifests were not transactionally rebuilt with every accepted
change. In addition, `build_manifest()` inventories only paths from the
current `SaveRecord` list, so reruns can leave pre-existing source files
outside the new inventory.

**Required prevention.**

1. **PENDING** — store immutable digest revisions.
2. **PENDING** — represent publication as release membership/pointer promotion.
3. **PENDING** — make manifests deterministic release outputs.
4. **PENDING** — verify every file/hash/count/link before signing a release.
5. **PENDING** — implement explicit supersession and rollback.

**Acceptance.** Reruns and corrections cannot alter an accepted revision; a
release can be reconstructed bit-for-bit from canonical records.

### F-08 — test architecture was coupled to mutable individual outputs

**Severity: high**  
**Finding status: DONE**  
**Greenfield test system status: PENDING**

**Evidence.** The full runner suite was rerun at the current HEAD with
coverage: 4,762 failed and 3,411 passed (8,173 total). There were 469 failing
files, including 455 per-PR adversarial files; logs contained 8,398
`FileNotFoundError` and 1,112 `AssertionError` occurrences. Coverage was 51.73%
line/statement, 43.86% branch, and 49.65% combined.

**Cause.** Thousands of one-off regression tests encoded mutable output paths
instead of stable invariants, curated benchmark fixtures, and release
validation.

**Required prevention.**

1. **PENDING** — unit-test pure canonical transformations.
2. **PENDING** — use upstream-supported fake transports for adapters.
3. **PENDING** — create stable adversarial legal benchmark fixtures.
4. **PENDING** — add schema, property, migration, contract, integration,
   release, and smoke tests.
5. **PENDING** — report line and branch coverage.
6. **PENDING** — selectively mutation-test critical identity/evidence logic.
7. **PENDING** — test corpus-wide invariants against a signed release, not
   transient PR paths.

**Acceptance.** The suite is green on a clean checkout, failures identify
current defects, and benchmark fixtures change only through reviewed
adjudication.

### F-09 — source rights are insufficiently granular

**Severity: critical**  
**Finding status: DONE**  
**Rights system status: PENDING**

**Evidence.** The current site publishes retained source text and summarizes
several legal bases in its README. A complete per-source-snapshot
redistribution decision is not enforced by the current content schema. The
measured 7,436 source frontmatter records have no license, rights, copyright,
named-provenance, or language fields.

**Cause.** Authority, access, research use, and redistribution were collapsed
into a source URL and general release narrative.

**Required prevention.**

1. **PENDING** — create a rights record for every snapshot.
2. **PENDING** — separate PD, open-license, metadata-only, and restricted
   research partitions.
3. **PENDING** — record license version, attribution, jurisdiction, and
   counsel/editorial decision.
4. **PENDING** — investigate selection/arrangement contamination where private
   or non-commercial sources influence structure.
5. **PENDING** — make release eligibility deterministic.
6. **PENDING** — create a separate privacy and sensitivity disposition for
   filings and records containing personal or confidential information.

**Acceptance.** Every public byte and structural import has a recorded release
basis and privacy/sensitivity disposition; restricted text can be excluded
without breaking provenance.

### F-10 — quota circumvention is not a sustainable acquisition method

**Severity: high**  
**Finding status: DONE**  
**Compliant acquisition status: PENDING**

**Evidence.** Current documentation and code describe a 100-proxy pool
(`proxies.txt`, Webshare, git-ignored) used for rotation. The configured
CourtListener token is deliberately **not sent** on proxied clients — the
free token is capped per token, while anonymous requests are throttled per
IP, "which is exactly what the 100-proxy pool defeats"
(`runner/legal_probe.py:55-88`); the token is spent only as a last-resort
429 fallback. The mechanism is therefore token suppression on proxied
requests, not the absence of a token, and its stated purpose is spreading
per-IP anonymous limits across proxies.

**Cause.** Synchronous production demand exceeded free service limits, and
source availability was treated as a throughput problem.

**Impact.** The method creates terms-of-service, partner, operational,
reputational, and reproducibility risk. It also encourages transient web
retrieval rather than durable source snapshots.

**Required prevention.**

1. **PENDING** — prohibit proxy rotation intended to evade service quotas.
2. **PENDING** — use documented APIs, bulk data, caching, paid tiers,
   partnerships, or rate-respecting queues.
3. **PENDING** — record terms/version and adapter policy per provider.
4. **PENDING** — design the pipeline to stop or defer work when lawful source
   access is unavailable.

**Acceptance.** Every adapter has a documented permitted access method,
bounded request policy, cache strategy, and owner; the program can show
compliance to a source partner.

### F-11 — retrieval adapters do not yet resolve all official content

**Severity: high**  
**Finding status: DONE**  
**Adapter completion status: PENDING**

**Evidence.**

- GovInfo content-link retrieval is implemented and demonstrated.
- The dedicated eCFR probe rejects its bot interstitial, but ordinary curation
  retained CFR material in the current-format forfeiture exemplar.
- Exact eCFR section/version text through the developer API remains absent.
- Probe and retention length floors differ (1,500 versus 200 characters).

**Cause.** Search result pages, canonical authority identity, content endpoints,
and source acceptance were developed independently. Dedicated probes and
ordinary research also apply different acceptance paths.

**Required prevention.**

1. **PENDING** — define one adapter contract from search through verified
   snapshot.
2. **PENDING** — implement official eCFR version/content retrieval.
3. **PENDING** — calibrate document validity by source type rather than one
   global length.
4. **PENDING** — resolve authority version/effective date before synthesis.
5. **PENDING** — add contract fixtures for interstitials, JavaScript shells,
   PDF-only records, XML, amendments, and repeals.

**Acceptance.** Each official adapter returns verified authority identity and
content or a typed failure; a successful search hit cannot masquerade as a
retrieved legal document.

### F-12 — the issue scheme is not yet a mature digest thesaurus

**Severity: critical**  
**Finding status: DONE**  
**Semantic curation status: PENDING**

**Evidence.** The current semantic scan found a dedicated `definition` for 660
of 1,705 digest paths, while 1,633 (95.8%) have either `definition` or the
legacy `description` fallback. Scope notes are present for 668, associative
relations for 159, typed legal relations for 135, and no explicit
polyhierarchy. Descriptive fallback coverage is therefore high; dedicated
semantic documentation and graph relationships are the thin layers.

**Cause.** Path-prefix generation and digest production preceded editorial
concept formation, scope control, polyhierarchy, and crosswalk review.

**Required prevention.**

1. **PENDING** — type candidates before minting concepts.
2. **PENDING** — require definitions and scope notes.
3. **PENDING** — review broader, alternate placement, related, and typed legal
   relations.
4. **PENDING** — distinguish authority, statutory regime, controversy,
   doctrine, issue, topic, and scaffold.
5. **PENDING** — validate mappings against pinned external schemes.

**Acceptance.** A stratified lawyer/librarian review clears concept,
relationship, label, and scope thresholds before the scheme is released.

### F-13 — historical scale does not establish current legal coverage

**Severity: high**  
**Finding status: DONE**  
**Coverage study status: PENDING**

**Evidence.** Earlier project materials relied heavily on historical,
public-domain treatise/digest headings. Current corpus counts report classified
or published artifacts, not the fraction of modern U.S. issues captured.

**Cause.** “Coverage” used the ingested dataset as its denominator.

**Required prevention.**

1. **PENDING** — reserve `ingestion completion` for processed-input metrics.
2. **PENDING** — define evaluated coverage benchmarks by practice area,
   jurisdiction, authority type, era, user task, and issue kind.
3. **PENDING** — intentionally sample modern administrative, statutory,
   regulatory, civil-rights, privacy, employment, health, finance,
   environmental, immigration, technology, and other post-historical fields.
4. **PENDING** — report uncovered and disputed areas.

**Acceptance.** Every coverage percentage states its external denominator and
sampling method.

### F-14 — international replication cannot be translation of the U.S. scheme

**Severity: critical for expansion**  
**Finding status: DONE**  
**Replication kit status: PENDING**

**Evidence.** The current publisher hard-codes English and derives hierarchy
from a U.S. filesystem path. FOLIO mappings are present, but mapping does not
create local doctrinal equivalence.

**Cause.** Language, jurisdiction, concept scope, and route were encoded as
site-level assumptions.

**Required prevention.**

1. **PENDING** — create explicit jurisdiction and language models.
2. **PENDING** — inventory local public professional vocabularies and sources.
3. **PENDING** — form a local topic-entry layer with local warrant.
4. **PENDING** — recruit local lawyers and librarians.
5. **PENDING** — create local authority/citation adapters.
6. **PENDING** — evaluate translations and cross-jurisdiction mappings as
   legal-semantic claims.

**Acceptance.** A local team can execute the documented method and produce a
gold-set evaluation without inheriting undocumented U.S./English parents or
labels.

### F-15 — the publisher is a useful prototype but not a qualified release gate

**Severity: high**  
**Finding status: DONE**  
**Greenfield publisher qualification: PENDING**

**Evidence.** At the current snapshot, `npm run check` OOMed with exit 134 near
a 4 GB heap; lint has one `no-console` error at `src/lib/corpus.ts:90`; format
check fails 24 files; `package.json` has no test or coverage script; and the
short CI path does not load the real corpus.

**Cause.** The site was optimized to publish a very large private sibling
corpus, while the check/test/CI contract was not made equivalent to the
production build and content seam.

**Required prevention.**

1. **PENDING** — make check/build heap requirements explicit in every local and
   CI script.
2. **PENDING** — add unit, integration, corpus-contract, accessibility, and
   smoke tests with coverage.
3. **PENDING** — make CI consume a signed representative corpus fixture and run
   release-parity checks.
4. **PENDING** — clear lint and format gates.
5. **PENDING** — run a full production-equivalent release build before
   promotion.

**Acceptance.** A clean CI environment validates the signed corpus and all
human/machine projections, reports coverage, completes the build, starts the
site, and receives HTTP 200 from its health/critical routes.

## Evaluation design

### Workstream 0 — concept and digest gold set

**Status: PENDING**

Recommended initial size:

- 600–1,200 concept candidates for issue/taxonomy evaluation;
- 300–600 source candidates for relevance/applicability evaluation;
- 1,000–2,000 atomic digest claims for claim-support/legal-correctness
  evaluation; and
- a dual-reviewed subset large enough to estimate agreement by important
  subgroup.

### Stratification

Sample across:

- professional topic entry;
- public/private/procedural/regulatory/international law;
- concept kind;
- source type;
- historical and modern era;
- federal, state, local, tribal, international, and comparative scope as
  applicable;
- hierarchy depth and polyhierarchy;
- clear and ambiguous/scaffold headings;
- retrieval confidence bands;
- language and script for expansion pilots; and
- common and rare issues.

### Review questions

For concepts:

1. Is this a recurring legal concept?
2. Is its concept kind correct?
3. Is the preferred label lawyer-usable?
4. Are definition and scope correct?
5. Are broader and related relations correct?
6. Is jurisdiction/time explicit?
7. Should the candidate merge, split, map, remain scaffold, or be rejected?

For sources:

1. Does the snapshot contain the identified authority/document?
2. Is it relevant to the issue?
3. Is it applicable in jurisdiction and time?
4. Is the authority type correct?
5. Is it primary, secondary, or merely discovery evidence?
6. Can it be redistributed?

For claims:

1. Is the proposition legally correct as scoped?
2. Does the evidence entail it?
3. Is the pinpoint accurate?
4. Are qualifications, exceptions, and contrary authority represented?
5. Is the authority current within the covered sources/date?
6. Would a practicing lawyer find the phrasing usable and conservative?

### Metrics

**PENDING** metrics to pre-register:

- concept acceptance/type/placement accuracy;
- source relevance and applicability precision/recall;
- claim support, legal correctness, pinpoint correctness;
- critical-error rate;
- retrieval recall at fixed review budget;
- inter-reviewer agreement with confidence intervals;
- correction rate by model/source/topic/jurisdiction;
- calibration of machine routing signals;
- retrieval usefulness compared with keyword and topic baselines; and
- latency/cost only after quality gates.

The launch threshold must include **zero adjudicated critical errors** in the
release sample and strong predeclared accuracy thresholds. An aspirational 85%
overall score is not sufficient if the remaining 15% includes wrong holdings,
wrong jurisdiction, invalid authority, or fabricated quotations.

Minimum pilot-promotion thresholds:

| Measure                                                    | Threshold |
| ---------------------------------------------------------- | --------: |
| Material public claims with resolving evidence spans       |      100% |
| Source snapshots with release-rights disposition           |      100% |
| Release files covered by a correct signed manifest         |      100% |
| High-severity errors in the release sample                 |         0 |
| Issue assignment accuracy                                  |      ≥95% |
| Lawyer-usable preferred-label accuracy                     |      ≥95% |
| Retained-source topical precision                          |      ≥98% |
| Primary-authority recall on registered benchmark questions |      ≥95% |
| Claim-support precision                                    |      ≥99% |
| Reviewer agreement on categorical decisions (chance-corrected: Cohen's κ for two raters, Krippendorff's α otherwise — not raw percent agreement) | ≥0.80 |

Before sampling, specify confidence level, target interval width, expected
prevalence, and minimum subgroup sizes. Each percentage threshold is met only
when the **lower bound** of its pre-registered confidence interval clears the
threshold, not when the point estimate does. Observing zero critical errors in
a sample of *n* bounds the true critical-error rate only to roughly 3/*n* at
95% confidence (the rule of three), so the release-sample size must be chosen
from the critical-error rate the program is willing to tolerate, not from
reviewer availability. A passing aggregate cannot override a failed high-risk
jurisdiction, source type, practice area, language, or concept kind. Any
critical error triggers remediation and a new independent release sample.

## Required research workflow

| Step                                  | Status      | Blocking output                           |
| ------------------------------------- | ----------- | ----------------------------------------- |
| Define issue and jurisdiction         | **PENDING** | Reviewed research scope                   |
| Build query plan                      | **PENDING** | Versioned channel/query plan              |
| Acquire official sources              | **PENDING** | Verified source snapshots                 |
| Determine rights                      | **PENDING** | Release eligibility per snapshot          |
| Rank relevance/applicability          | **PENDING** | Accepted/rejected candidates with reasons |
| Resolve authorities and versions      | **PENDING** | Canonical authority records               |
| Draft atomic claims                   | **PENDING** | Claim/evidence graph                      |
| Run deterministic validation          | **PENDING** | Structural gate report                    |
| Conduct independent legal review      | **PENDING** | Signed decisions                          |
| Conduct knowledge-organization review | **PENDING** | Concept/relationship decisions            |
| Adjudicate disagreement               | **PENDING** | Final accepted revision                   |
| Build immutable release               | **PENDING** | Signed reproducible artifacts             |
| Perform blind release audit           | **PENDING** | Published quality report                  |

## Good-to-have research work

| ID   | Status      | Work                                                                   | Reason                                                             |
| ---- | ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| G-01 | **PENDING** | Blinded competitive retrieval study against available lawful baselines | Demonstrates user value rather than output volume                  |
| G-02 | **PENDING** | Practitioner task diary/interview study                                | Improves user warrant and entry-topic design                       |
| G-03 | **PENDING** | Active-learning review selection                                       | Uses specialists efficiently after unbiased benchmarks exist       |
| G-04 | **PENDING** | Red-team challenges from opposing specialists                          | Exposes exceptions, minority rules, and misleading generalizations |
| G-05 | **PENDING** | Longitudinal reviewer-drift study                                      | Protects conservative consistency over time                        |
| G-06 | **PENDING** | Public error bounty                                                    | Encourages scrutiny after governance and response capacity exist   |
| G-07 | **PENDING** | Classroom usability study                                              | Tests pedagogical value separately from practitioner validity      |
| G-08 | **PENDING** | Cross-language retrieval benchmark                                     | Measures international value beyond translation quality            |

## Stop rules

Generation pauses automatically when:

- source identity or hash integrity fails;
- a public methodological invariant and executable gate diverge;
- critical legal error appears in a release audit;
- source relevance falls below its registered threshold;
- reviewer disagreement exceeds its control limit;
- an adapter violates access policy or returns unverifiable content;
- rights status is missing;
- a schema migration loses information;
- accepted revisions can be changed in place;
- an external vocabulary version cannot be reproduced; or
- language/jurisdiction scope is missing.

Throughput, funding deadlines, and already-spent model cost do not override a
stop rule.

## Readiness decision

The project may begin **pilot research** only after F-01 through F-11 have
their prevention actions marked **DONE** and the evaluation protocol is
pre-registered. It may publish a **curated beta** only after F-12 through F-15
also pass, the release sample clears the legal-quality thresholds, and an
independent builder reproduces the signed release.

The method's strongest market claim will not be “we used the same kind of
models at scale.” It will be:

> We converted institutional and source warrant into conservative editorial
> decisions through a method that another qualified team can inspect, rerun,
> measure, challenge, and reproduce.

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
