# Bottleneck decisions — 2026-07-30

Decider: Arthur S. Rodrigues. Context: the two 2026-07-29 plan sets
([all-generated](all-generated-2026-07-29/2026-07-29-RESEARCH_METHOD_AUDIT.md),
[from-scratch](from-scratch-2026-07-29/2026-07-29-RESEARCH_METHOD_AUDIT.md))
describe scenario-hypothetical programs; the
[2026-07-30 verification addendum](2026-07-30-verification-addendum.md)
confirmed their findings against code. Reality matches neither scenario:
~1,705 bundles exist, the 137,139-row ledger is unvalidated, and the runner
is actively generating. These decisions resolve the plans' bottlenecks and
parameterize both documents. Where a decision narrows or rescopes a plan
statement, this record governs.

## D1 — Scenario: hybrid, freeze then gates

The governing program is neither pure brownfield nor pure greenfield:

1. Freeze the current generated tree as an immutable evidence release
   (brownfield R-01 / P0-001, executed now, at current size — not at an
   assumed 137,139).
2. Run the greenfield Phase 0–1 work next: canonical contracts, opaque
   identity, rights schema, work ledger, gold-set design.
3. The generated corpus (existing and continuing) is **candidate input** to
   the new registry, never pre-validated content.

Consequence: the brownfield plan's preserve/inventory gates run first; the
greenfield plan's contract/identity gates run before any repair campaign;
neither plan's full sequencing is adopted wholesale.

## D2 — Generator: patch, then continue

Generation resumes only after a blocking patch list lands, and continues
under quarantine:

**Blocking patches (before resume):**

- P-1 — Freeze first: snapshot the current tree before any code change
  (D1 step 1 precedes the patch).
- P-2 — RetainedSource identity: one immutable record per source through
  save/classify; eliminate both defects (positional join after rejection,
  and the `source_markdown` / `source_documents` collection mismatch).
- P-3 — Manifest integrity: `run.json` frozen as generation provenance;
  inventories cover actual disk state of the bundle, not only current
  `SaveRecord`s.
- P-4 — Stage-regression remediation: restore the honesty/consistency
  behaviors the LLM-judge report and changelog identify as lost between
  stage 2 (5.3/5.8/5.1/5.2) and the current stage (3.4/5.2/4.4/4.1).

**Continuation conditions:**

- All continued output lands in an explicit `generated`/`candidate` channel
  and cannot reach `reviewed`/`validated` without the D3 gates.
- The plans' stop rules are rescoped: they block **release**, not
  generation-into-quarantine. Two remain tripped for release (topicality
  ungated; rights undetermined) and are accepted for candidate acquisition
  only.
- Residual risk, accepted and flagged: acquisition continues on the
  100-proxy pool. Standing recommendation: migrate caselaw acquisition to
  CourtListener bulk data (lawful, unthrottled for this purpose) as the
  first adapter under greenfield R-05.

## D3 — Review staffing: LLM triage + human audit stream (pilot mode)

Chosen: calibrated LLM triage concentrating human review hours, with a
random audit stream keeping the base rate honest.

Recorded consequence, stated plainly: **triage cannot create the gold set or
agreement statistics.** The interim human in the audit stream is the
founder, who also authored the pipeline. Therefore:

- Pilot mode: founder labels the seed audit stream; the triage/judge harness
  (extending `methodology_judge.py`) is calibrated against those labels;
  triage then routes founder hours.
- Every `validated`-channel gate in both plans (gold set, dual review,
  κ ≥ 0.80, zero-critical-error release samples) remains **PENDING/blocked**
  until at least one independent qualified reviewer exists — self-approval
  stays prohibited. No public "validated" or competitive-quality claim is
  available in pilot mode.
- Revisit trigger: before the first curated-beta release candidate, staffing
  must be re-decided (paid micro-panel and/or law-school partnership were
  the elicited alternatives).

## D4 — Source rights: status quo, risk-accepted

The site continues republishing retained source full text under the README
theory (17 U.S.C. § 105; *Georgia v. Public.Resource.Org*) while the
per-snapshot rights schema is built. This is an explicit, dated risk
acceptance, not an oversight. Sharpest accepted edges, named:

- personal data in court filings (e.g., the CourtListener RECAP declaration
  duplicated into 64 issue directories);
- private secondary works retained by ordinary curation (law-firm articles,
  a Studicata brief) that the public-domain theory does not cover.

Revisit triggers: the rights schema landing (then dispositions become
enforceable and this acceptance expires), any takedown request or
complaint, or counsel advice to the contrary.

## Resulting execution order

1. Freeze + content-addressed inventory of the current tree (D1/P-1).
2. Land P-2/P-3/P-4; resume generation into quarantine (D2).
3. Greenfield Phase 0–1: contracts, opaque IDs, rights schema, work ledger.
4. Build the triage/judge harness; founder-labeled seed audit stream (D3).
5. Migrate caselaw acquisition to CourtListener bulk data (D2 residual).
6. Gold-set design pre-registered; staffing re-decision before any
   curated-beta candidate (D3 revisit trigger).

Deferred decisions, explicitly open: public IRI migration (path-derived →
opaque) with legacy aliases; publishing topology at scale (current static
build suffices for pilot scale); counsel review of source classes (D4
trigger-driven).
