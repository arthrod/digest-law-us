# Runner v3 proposals — from-scratch program — 2026-07-29

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

## Scenario and status convention

This document assumes that **no new digest article or release has been
generated**. The current `key-digest-runner` and `digest-law-us` repositories
are evidence about what can be reused and what must not be repeated; they are
not evidence that the greenfield corpus exists.

Every work item has one of two statuses:

- **DONE** — the named decision is settled, or an independently reusable
  component exists in the current implementation and its evidence is cited.
- **PENDING** — the new-from-scratch program has not yet met the stated
  acceptance test.

An item that contains completed and uncompleted work is divided into smaller
items so that every row is either `DONE` or `PENDING`.

## Product target

The target is an open, lawyer-usable legal issue digest with the conservative
editorial discipline associated with the West Topic and Key Number System,
while making each editorial and machine decision inspectable and reproducible.
The target is not merely a large set of generated essays.

The first release must provide:

1. a stable, versioned registry of legal issues;
2. lawyer-facing topic access and librarian-facing controlled-vocabulary
   semantics;
3. claim-level links to retained authority;
4. conservative human adjudication before public release;
5. reproducible provenance for source acquisition, classification, synthesis,
   review, correction, and publication;
6. jurisdiction and language boundaries that can be extended without treating
   United States doctrine or English labels as universal; and
7. a path to authority treatment and citation-history services without
   pretending that a digest is already a citator.

West Digests, the West Key Number System, and LexisNexis headnotes are the
direct functional benchmarks for issue classification. KeyCite and Shepard's
are citator benchmarks. A system becomes a competitor to a citator only after
it reliably models
authorities, subsequent history, citing references, treatment, effective
dates, and jurisdictional validity. Until those gates are met, the product must
describe itself as **digest and citator-adjacent**, not as a citator.

## Evidence snapshot used for this plan

Snapshot date: **2026-07-29**.

| Evidence                                                                     | Observed fact                                                                                                                                                                                                                                                                                                                                                                                                                                          | What it proves                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key-digest-runner/runner/run_key_digest_research_workers.py`                | Issue selection, provider execution, source saving, index rendering, manifest writing, and PR work are orchestrated in one runner.                                                                                                                                                                                                                                                                                                                     | The full workflow is technically feasible, but its boundaries need to be made transactional and independently testable.                                                                                                     |
| `key-digest-runner/runner/legal_probe.py`                                    | CourtListener, GovInfo, and eCFR channels are represented; GovInfo content links are fetched; eCFR document text is not yet fetched through its developer API.                                                                                                                                                                                                                                                                                         | Primary-law-first retrieval is feasible; channel-specific retrieval needs explicit contracts.                                                                                                                               |
| `key-digest-runner/runner/source_classify.py`                                | Deterministic evidence buckets and a narrow retention gate exist. The gate expressly does not judge topical relevance.                                                                                                                                                                                                                                                                                                                                 | Structural source typing is reusable; relevance and legal applicability remain separate unsolved decisions.                                                                                                                 |
| `key-digest-runner/runner/run_manifest.py`                                   | Per-digest `run.json` and append-only `runs.jsonl` structures exist.                                                                                                                                                                                                                                                                                                                                                                                   | Reproducible run provenance is a proven pattern.                                                                                                                                                                            |
| `key-digest-runner/runner/okf_lint.py` and `key_digest/repair_okf_bundle.py` | Write-time lint and repair rules exist because thousands of historical files needed normalization.                                                                                                                                                                                                                                                                                                                                                     | Fail-closed validation should precede generation, not be a later repair campaign.                                                                                                                                           |
| Current v3 ledger scan                                                       | 137,139 records from 156,802 items; 1,607 merged issues; 10,177 multi-item issues; maximum 271 members; 104,572 real FOLIO area `R*` identifiers, 32,567 local area identifiers, and 137,139 objective `R*` identifiers                                                                                                                                                                                                                                | Identity normalization, deduplication, and operational anchoring work at scale; none is specialist validation or a reviewed SKOS mapping.                                                                                   |
| Current corpus scan                                                          | 1,705 digest-shaped bundles, 1,636 `run.json` files (69 absent), 7,436 source Markdown files, and 41 roots—31 current doctrinal plus 10 legacy composite—occupy about 1.6 GB. Five of 36 v3 doctrinal roots are absent physically; naive coexistence would expose 46 roots.                                                                                                                                                                            | The publisher and artifact layout have been exercised at meaningful scale; root systems require adjudicated migration and this scenario nevertheless assumes zero accepted new digests.                                     |
| Current source-store scan                                                    | 7,436 files contain 6,346 unique bodies; 1,090 copies account for 526,940,196 reclaimable bytes (32.67%). Zero source frontmatter records declare license, rights, copyright, named provenance, or language; only eight declare jurisdiction.                                                                                                                                                                                                          | Greenfield storage must separate canonical snapshots, occurrences, rights, safety, and issue use.                                                                                                                           |
| Latest 14 existing bundles                                                   | 131 sources (minimum/mean/maximum 3/9.357/21); 3 dedicated definitions; 3 scope notes; 1 alternate-label set; no `related`/`narrower`/multi-`broader`/typed legal relations; 13 FOLIO groups; no other mappings; 63 of 75 Markdown URLs match retained resources, while one 10-source bundle has no link                                                                                                                                               | Current-format generation can meet a file-count floor while remaining semantically sparse; URL matching is a grounding proxy, not accuracy.                                                                                 |
| Current manifest scan                                                        | 48 missing inventory files across 26 bundles; 130 SHA mismatches across 69; 121 byte mismatches across 62; 855 disk sources absent from inventories across 169; 154 retained-count, 166 declared-evidence-count, and 169 evidence-list-length mismatches; 44 evidence filenames absent from disk across 24; 995 disk sources absent from evidence across 201; filename-set differences across 172; 12,309 absolute versus 711 relative inventory paths | Files changed after generation and `build_manifest()` inventories only current `SaveRecord` paths. The greenfield manifest must be transactional, complete, and portable.                                                   |
| Current SKOS-frontmatter scan                                                | Of 1,705 digest-shaped files, 660 had a dedicated non-empty `definition`; 1,633 (95.8%) had either `definition` or the legacy `description` fallback; 668 had non-empty scope notes; 159 had `related` values; 135 had populated project-specific legal relations; and none parsed with more than one explicit `broader` value.                                                                                                                        | Legacy descriptive coverage is high, but dedicated definitions, scope control, and graph relationships remain materially thinner. Merely emitting SKOS-shaped fields does not produce a thesaurus-quality semantic network. |
| Current runner test/coverage run                                             | 4,762 failed and 3,411 passed (8,173 total); 469 files failed, including 455 per-PR adversarial files; coverage was 51.73% line/statement, 43.86% branch, 49.65% combined.                                                                                                                                                                                                                                                                             | The greenfield suite must use stable contracts and adjudicated fixtures rather than mutable per-PR corpus paths.                                                                                                            |
| Current site qualification                                                   | `npm run check` OOMed with exit 134 near a 4 GB heap; lint has one `no-console` error at `src/lib/corpus.ts:90`; format check fails 24 files; there is no test/coverage script; the short CI path does not load the corpus.                                                                                                                                                                                                                            | The publisher is a scale prototype, not a qualified greenfield release pipeline.                                                                                                                                            |
| `digest-law-us/src/lib/skos.ts`                                              | Public IRIs are derived from slug paths; English is hard-coded; the folder parent is injected as `skos:broader`.                                                                                                                                                                                                                                                                                                                                       | The present publication pattern is useful as a prototype but cannot be the new registry's identity or multilingual model.                                                                                                   |
| `digest-law-us/src/content.config.ts`                                        | Schemas are intentionally permissive and use `.passthrough()`.                                                                                                                                                                                                                                                                                                                                                                                         | Legacy tolerance is useful for display, but an authoritative greenfield release requires strict ingest validation.                                                                                                          |
| `key-digest-runner/docs/RESEARCH_METHOD_AUDIT.md` and `docs/TODO.md`         | The current method found topical junk, stale manifests, overwritten remediation, and thousands of corpus-coupled test failures.                                                                                                                                                                                                                                                                                                                        | Corpus generation must not begin until relevance, integrity, revision, and test architecture are designed.                                                                                                                  |

Counts above describe the available implementation evidence, not the output
count for this scenario. The new corpus count is **zero**.

## Decisions already made

| ID   | Status   | Decision                                                                                                                          | Reason                                                                                                              |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D-01 | **DONE** | The research unit is a canonical legal issue, not a source heading or historical item.                                            | Headings are evidence of concepts; they are not automatically concepts.                                             |
| D-02 | **DONE** | The issue registry owns opaque stable identifiers. Labels, paths, external mappings, and publication URLs do not define identity. | Labels and placements change across editions and languages.                                                         |
| D-03 | **DONE** | Browse structure is polyhierarchical and supplemented by associative relations.                                                   | Legal issues routinely cross practice areas, procedures, remedies, actors, and statutes.                            |
| D-04 | **DONE** | Generation is evidence-first and claim-level, followed by conservative human review.                                              | Model confidence and provenance are not measures of legal correctness.                                              |
| D-05 | **DONE** | FOLIO is an interoperability reference plane, not the operative issue registry.                                                   | A federation ontology and a detailed jurisdictional digest serve different functions.                               |
| D-06 | **DONE** | Source acquisition and source reuse are separate rights decisions.                                                                | Public accessibility does not establish a right to redistribute text.                                               |
| D-07 | **DONE** | English and United States law are the first edition, not the universal ontology.                                                  | International replication requires local warrant, specialists, language labels, and jurisdiction-specific doctrine. |
| D-08 | **DONE** | No public digest may be silently overwritten by a rerun.                                                                          | The existing corpus demonstrated that reruns can discard remediation.                                               |
| D-09 | **DONE** | “No authority found” is a reviewable research result, not permission to invent or pad.                                            | Honest absence is preferable to false completeness.                                                                 |
| D-10 | **DONE** | Digest classification and citator treatment are separate products with an explicit integration boundary.                          | Topic equivalence is not authority validity or treatment.                                                           |

## Required plan

### R-01 — freeze the concept and artifact contracts before generation

**Status: PENDING**

**Problem.** In the current implementation, paths, frontmatter, source files,
indexes, and manifests evolved during production. Repairs then had to infer the
intended contract from heterogeneous files.

**Evidence.** `key-digest-runner/runner/okf_lint.py`,
`key_digest/repair_okf_bundle.py`, and the hygiene audit document thousands of
normalizations. `digest-law-us/src/content.config.ts` remains deliberately
loose to display legacy output.

**Cause.** Generation began before one normative schema covered concepts,
issues, claims, authorities, evidence spans, rights, runs, reviews, and
revisions.

**Proposal.** Publish versioned JSON Schemas or equivalent typed models for:

- `Concept`;
- `IssuePlacement`;
- `IssueRelation`;
- `SourceRecord`;
- `Authority`;
- `AuthorityVersion`;
- `EvidenceSpan`;
- `DigestClaim`;
- `DigestRevision`;
- `EditorialDecision`;
- `RunAttempt`; and
- `ReleaseManifest`.

The canonical store must be structured data. Markdown, HTML, JSON-LD, RDF, and
search indexes are deterministic projections.

**Acceptance.**

- Every entity has a schema version and immutable identifier.
- Unknown fields fail in the authoritative ingest path.
- Fixtures cover valid, invalid, previous-version, and migration cases.
- A round-trip test proves that no canonical information is lost through a
  publish/export cycle.

### R-02 — build the issue registry and topic-entry layer

**Status: PENDING**

**Problem.** Treatise headings and generated path prefixes can be scaffolding,
duplicate expressions, authorities, statutes, or genuine issues. Automatically
minting all of them as equivalent concepts creates false precision.

**Evidence.** The prior pipeline treated path prefixes as concepts. The current
corpus has very sparse definitions, scope notes, associative links, and no
observed explicit polyhierarchy.

**Cause.** Extraction, candidate formation, concept adjudication, and browse
placement were collapsed into one operation.

**Proposal.**

1. Form a 400–700 term **professional topic-entry layer** from independently
   recorded public law-library research guides, public controlled
   vocabularies, modern open sources, historical digests, and specialist input.
2. Record source-level warrant for every candidate label without implying
   institutional endorsement.
3. Type every candidate as `topic`, `issue`, `doctrine_or_test`,
   `statutory_regime`, `authority`, `controversy`, `scaffold`, or `reject`.
4. Adjudicate equivalence, boundaries, preferred labels, scope notes, and
   placements before minting a public issue.
5. Keep historical items as source records linked to the canonical concept.

**Acceptance.**

- Two qualified reviewers adjudicate a stratified sample before bulk work.
- Every public concept has a definition, scope note, concept kind, jurisdiction,
  language-tagged preferred label, warrant, and at least one reviewed
  placement.
- Container and scaffold terms cannot enter the issue registry through the
  generation API.
- The topic-entry layer has documented source coverage and specialist approval.

### R-03 — create a durable work ledger

**Status: PENDING**

**Reusable evidence: DONE.** `runner/run_manifest.py` demonstrates per-run
manifests and an append-only attempt journal.

**Problem.** Random selection and filesystem existence are not enough to
coordinate a conservative editorial program.

**Cause.** The existing runner treats generation as a job loop rather than a
state machine over immutable issue revisions.

**Proposal.** Use a transactional database with:

- issue revision;
- jurisdiction and language;
- research plan version;
- attempt state and lease;
- source snapshot identifiers;
- model and prompt identifiers;
- deterministic validation results;
- reviewer assignments and independence;
- editorial disposition;
- publication release;
- supersession links; and
- retry reason and bounded budget.

**Acceptance.**

- A crash cannot create two accepted revisions or lose an attempt record.
- The same issue may be researched concurrently only under explicit
  experiment IDs.
- State transitions are enumerated and invalid transitions are rejected.
- Re-running an accepted issue creates a new immutable revision.

### R-04 — implement rights-aware source intake

**Status: PENDING**

**Problem.** “Available online,” “authoritative,” “usable for analysis,” and
“redistributable in full” are different properties.

**Evidence.** The current publisher distributes retained source text while the
README describes multiple legal bases in one short licensing paragraph.
Current manifests do not provide a complete per-file rights determination. In
the measured 7,436 source files, zero frontmatter records declare license,
rights, copyright, named provenance, or language; only eight declare
jurisdiction.

**Cause.** Retrieval metadata and publication-rights metadata are not enforced
as separate gates.

**Proposal.** Each source snapshot must record provenance, publisher,
jurisdiction, authority type, access date, content hash, version/effective date,
retrieval method, rights basis, license text or citation, permitted uses,
redistribution status, privacy/sensitivity/redaction disposition, and
reviewer/counsel disposition where required. Store the body once by verified
content identity and represent retrieval and issue-use occurrences separately.

**Acceptance.**

- A source without a rights disposition can be quarantined for analysis but
  cannot enter a public artifact.
- PD-only, openly licensed, metadata-only, and restricted research channels are
  reproducibly separable.
- A release can be rebuilt without including restricted source text or
  selection/arrangement.
- A filing or personal record cannot publish without a distinct
  privacy/sensitivity decision.

### R-05 — implement primary-law acquisition by jurisdiction

**Status: PENDING**

**Reusable components: DONE.** CourtListener and GovInfo probe adapters,
content-link handling, evidence bucketing, and retry instrumentation exist in
the current runner.

**Problem.** Generic web ranking produces topical collisions and weak authority.
The current eCFR search path can identify candidates without retrieving
official section content through the developer API. The dedicated probe rejects
the eCFR shell, while ordinary curation can still retain CFR/eCFR material.

**Cause.** Search discovery, official document retrieval, version resolution,
and issue relevance are treated as one loose URL pipeline.

**Proposal.** Give every source family an adapter implementing:

`search → resolve canonical authority → select version → fetch content →
verify content type → segment → hash → rights classify → emit SourceRecord`.

Start with official or stable public sources for cases, codes, regulations,
session laws, court rules, constitutions, agency adjudications, and selected
secondary warrant. Generic web search is a discovery supplement, never the
authority baseline.

**Acceptance.**

- Contract tests use upstream-supported fake transports.
- Fixtures cover rate limits, CAPTCHA/interstitial pages, PDFs, XML, amended
  provisions, withdrawn opinions, duplicate URLs, and redirected identifiers.
- Channel quality is reported by jurisdiction, authority type, and date.
- A retrieved source is not “authority” until its identity and document type
  are verified.
- A governed source-kind classifier distinguishes opinions, orders, briefs,
  declarations, other filings, statutory/regulatory material, agency
  publications, and secondary sources; domain name alone cannot decide kind.

### R-06 — preserve source identity through every stage

**Status: PENDING**

**Problem.** The current save path can compact the list of saved filenames
after rejecting a source, then assign those names positionally to the original
uncompacted source list.

**Evidence.** In `save_research_output`, rejected `source_markdown` entries are
skipped when `SaveRecord`s are built. `classify_retained_sources` separately
enumerates all original `source_documents` and applies the compacted
`saved_names[index]`. The two functions also iterate different collections
(`output.source_markdown` versus `output.result.source_documents`), so a
length divergence misbinds filenames even with zero rejections.

**Cause.** A source has no immutable identity carried through discovery,
fetching, retention, saving, classification, citation, and manifest assembly.

**Proposal.** Represent each source as one typed object with a generated
`source_snapshot_id`. All transformations return that ID. Never join parallel
arrays by index. Build filenames from the ID, not from list position.

**Acceptance.**

- Rejecting any subset of sources cannot change another source's URL,
  filename, hash, authority class, or evidence links.
- Property-based tests exercise arbitrary rejection patterns.
- The release manifest independently recomputes every file-to-source binding.

### R-07 — add semantic topicality and applicability review

**Status: PENDING**

**Problem.** A source can be legal, dense with legal vocabulary, and still be
about the wrong issue or the wrong jurisdiction/time.

**Evidence.** `source_classify.retention_gate()` explicitly says that it does
not judge topicality. The method audit records restaurant results for “accord”
and an unrelated tax regulation for adverse possession. The current-format
forfeiture exemplar retains unrelated 50 CFR material, a 31 CFR `[Reserved]`
section, and an unrelated medical-device law-firm article.

**Cause.** High-precision hygiene rules were mistaken for a relevance system;
there was no labeled relevance set.

**Proposal.**

1. Build a lawyer-adjudicated source-relevance set stratified by topic,
   authority type, era, jurisdiction, and hard negatives.
2. Evaluate lexical, embedding, reranker, and model-based relevance methods.
3. Use deterministic identity/jurisdiction/date filters first.
4. Require a calibrated semantic score only as triage.
5. Send borderline and contradictory results to reviewers.

**Acceptance.**

- Required primary-source recall and irrelevant-source precision thresholds are
  fixed before tuning.
- Performance is reported on a held-out set and per subgroup.
- No automatic threshold may be deployed without an error budget and rollback
  test.
- Reviewers can see rejected candidates and reasons.

### R-08 — synthesize atomic claims, not an opaque essay

**Status: PENDING**

**Problem.** A source list attached to a digest does not show which authority
supports which proposition.

**Cause.** The current main artifact is authored as Markdown and citations are
later rendered around it. Claim identity and evidence entailment are not the
canonical unit.

**Proposal.** Generate a structured claim graph first. Each claim records:

- claim ID and normalized proposition;
- issue ID and jurisdiction;
- rule, exception, element, defense, remedy, procedure, or uncertainty type;
- authority IDs and pinpoint evidence spans;
- quotation or faithful extract;
- temporal applicability;
- contrary or limiting authority;
- machine confidence used only for routing;
- reviewer disposition and explanation; and
- supersession history.

Markdown is rendered only from accepted claims.

**Acceptance.**

- Every material public legal proposition has at least one resolvable evidence
  span. Editorial synthesis is a typed inference over supported premises;
  unsupported leads and open questions remain quarantined.
- Quoted text byte-matches the retained snapshot after normalization.
- A deterministic check rejects dangling citations and wrong-source spans.
- A lawyer can move from a sentence to the exact supporting text in one action.

### R-09 — establish conservative human curation

**Status: PENDING**

**Problem.** Users trust West and Lexis because editorial decisions are
conservative and repeatable, not merely because professionals are somewhere in
the loop.

**Evidence.** The existing process emphasizes a PR gate, while deterministic
merge enforcement does not establish legal correctness, reviewer independence,
or documented adjudication.

**Cause.** “Human review” was treated as a binary event rather than a measured
editorial protocol.

**Proposal.**

- Define reviewer qualifications by jurisdiction and subject.
- Use dual independent review for the gold set and high-risk releases.
- Give reviewers an issue-definition rubric, source-relevance rubric,
  claim-support rubric, hierarchy/relationship rubric, and error severity
  taxonomy.
- Adjudicate disagreements and record reasons.
- Blind reviewers to model confidence where feasible.
- Measure agreement, correction rates, and reviewer drift.

**Acceptance.**

- Critical legal errors are zero in the launch sample after adjudication.
- Overall claim-support accuracy, issue classification accuracy, and source
  relevance clear predeclared thresholds.
- Inter-reviewer agreement and disagreement typology are published.
- A reviewer cannot approve their own generated or edited record.

### R-10 — generate useful authority indexes

**Status: PENDING**

**Reusable component: DONE.** The current runner deterministically divides
retained sources into caselaw, statutory, and secondary buckets and renders
index files.

**Problem.** Filename/URL tables and citation regexes are not yet a professional
table of authorities.

**Proposal.** Normalize authorities into a registry with citation variants,
court/issuer, jurisdiction, date, version, official source, cited propositions,
pinpoints, and treatment status when available. Render caselaw, legislation,
regulation, and secondary-source views from that registry.

**Acceptance.**

- Every authority row resolves to an `Authority` and at least one evidence
  span.
- Duplicate citations consolidate without merging distinct authorities.
- Court, reporter, date, code edition, regulation version, and jurisdiction are
  independently validated.
- Empty indexes state which channels and queries were attempted.

### R-11 — build the citator boundary

**Status: PENDING**

**Problem.** A topical digest does not tell a lawyer whether a case remains
good law or whether a statute/regulation was amended, repealed, stayed, or
superseded.

**Proposal.** Create a separate authority graph:

- case-to-case citations and procedural history;
- treatment assertions with evidence and reviewer confidence;
- statute/regulation version lineage and effective dates;
- court hierarchy and jurisdiction;
- negative-history alerts;
- update timestamps and coverage disclosures.

The digest may display these records, but must not infer “good law” from the
absence of detected negative treatment.

**Acceptance.**

- Treatment labels have a published taxonomy and adjudication rubric.
- Recall is measured against licensed or independently constructed benchmark
  sets with lawful evaluation conditions.
- Every treatment has a source, context span, date, and reviewer disposition.
- The interface distinguishes “no negative treatment found in covered
  sources” from “valid.”

### R-12 — make publication a reproducible release

**Status: PENDING**

**Reusable component: DONE.** `digest-law-us` proves that static digest,
source, audit, provenance, search, and JSON-LD pages can be published at corpus
prototype scale.

**Problem.** Current publication derives identity from paths, injects folder
parents into SKOS, hard-codes English, accepts permissive legacy schemas, and
depends on a private sibling corpus.

**Proposal.**

- Resolve opaque issue IDs to mutable human-readable routes.
- Publish content-negotiated canonical concept IRIs and separate page URLs.
- Build from a signed release artifact, not a private sibling checkout.
- Enforce strict release schemas, SHACL, link integrity, language tags, rights
  filters, accessibility, performance, and provenance consistency in CI.
- Provide versioned bulk downloads and diffs.

**Acceptance.**

- Moving or relabeling a concept does not change its canonical IRI.
- All links, mappings, language tags, hashes, rights states, and redirects
  validate before deployment.
- A clean environment reproduces the signed release.
- The site passes automated accessibility, security, performance, unit,
  integration, and smoke-test gates.

## Good-to-have plan

Each item remains useful but cannot delay the minimum trustworthy launch unless
it becomes necessary to satisfy a required acceptance gate.

| ID   | Status      | Capability                                     | Why it helps                                                  | Acceptance                                                                                                                   |
| ---- | ----------- | ---------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| G-01 | **PENDING** | Reviewer recommendation and workload balancing | Routes issues to the right specialist and reduces drift.      | Recommendations are explainable, overrideable, and audited for workload bias.                                                |
| G-02 | **PENDING** | Active-learning queues                         | Concentrates expert time on uncertain or high-impact records. | Evaluation shows a higher corrected-error yield than random review without reducing benchmark coverage.                      |
| G-03 | **PENDING** | Multilingual assisted label drafting           | Speeds cross-language terminology work.                       | Every public label is approved by a qualified local-language legal reviewer; machine-only labels are never preferred labels. |
| G-04 | **PENDING** | User-submitted issue and correction workflow   | Captures professional user warrant.                           | Submissions are versioned, moderated, attributed, and never change public records directly.                                  |
| G-05 | **PENDING** | Knowledge-graph query API                      | Supports legal informatics and downstream AI.                 | API has stable versioning, pagination, license metadata, and parity tests against bulk releases.                             |
| G-06 | **PENDING** | Retrieval benchmark and challenge set          | Makes competitive quality visible.                            | Public questions compare keyword, taxonomy, and hybrid retrieval with blinded lawyer scoring.                                |
| G-07 | **PENDING** | Citation-context embeddings                    | Improves related-issue and treatment candidate generation.    | Candidates remain non-authoritative until reviewed; held-out recall improves materially.                                     |
| G-08 | **PENDING** | Print/API/offline packages                     | Serves courts, classrooms, and low-connectivity users.        | All formats derive from one signed release and preserve identifiers and citations.                                           |

## Generation readiness gates

No production-scale generation begins until every gate below is **DONE**.

| Gate                                     | Current status | Stop rule                                                                                         |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Canonical schemas and migrations         | **PENDING**    | Stop if any output fact exists only in Markdown.                                                  |
| Stable issue identity and revision model | **PENDING**    | Stop if relabeling or reparenting changes an ID.                                                  |
| Topic-entry layer evaluation             | **PENDING**    | Stop if reviewers cannot distinguish topic, issue, authority, controversy, and scaffold reliably. |
| Rights-aware source pipeline             | **PENDING**    | Stop if public release eligibility cannot be computed per snapshot.                               |
| Source identity integrity                | **PENDING**    | Stop on any URL/file/hash/evidence mismatch.                                                      |
| Source topicality benchmark              | **PENDING**    | Stop if thresholds are tuned without a held-out lawyer-labeled set.                               |
| Claim-evidence structural gate           | **PENDING**    | Stop on any unsupported public proposition or dangling pinpoint.                                  |
| Independent legal review protocol        | **PENDING**    | Stop if approval is a merge event without recorded adjudication.                                  |
| Multilingual/jurisdiction model          | **PENDING**    | Stop if language or U.S. jurisdiction is inferred from a path.                                    |
| Release reproducibility                  | **PENDING**    | Stop if a clean builder cannot recreate and verify the release.                                   |

## Recommended execution order

1. Complete R-01, R-02, R-03, and R-04.
2. Build a small, deliberately difficult benchmark across modern and
   historical public/private law, procedure, and regulation.
3. Complete R-05 through R-09 against that benchmark.
4. Run a 600–1,200-concept pilot; publish the evaluation, not the corpus.
5. Complete R-10 and R-12; publish a curated beta only after the gates pass.
6. Scale issue-by-issue with immutable revisions and periodic blind audits.
7. Develop R-11 as a separately measured authority-treatment program.
8. Start a second jurisdiction only after the method can be executed by local
   librarians and lawyers without relying on undocumented U.S. assumptions.

Scale is the last optimization. The competitive advantage is not generation
throughput; it is conservative, observable, repeatable editorial judgment.
