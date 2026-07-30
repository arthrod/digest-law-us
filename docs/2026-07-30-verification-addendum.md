# Verification addendum — 2026-07-30

> The bottlenecks these documents surface were decided on 2026-07-30 — see
> the [bottleneck decision record](2026-07-30-bottleneck-decisions.md),
> which parameterizes both plan sets.

This addendum re-verifies the ten documents in
`docs/all-generated-2026-07-29/` and `docs/from-scratch-2026-07-29/` against
the actual code of `digest-law-us` (working tree, 2026-07-30) and
`key-digest-runner` (HEAD `f621abab`, with the pinned audit commit
`265a8610` checked directly where line numbers were decisive). It records
what was confirmed, what was corrected in place, what has drifted since the
`2026-07-29T18:03:54Z` measurement cutoff, and the protocol rules adopted so
future reports stay verifiable.

## 1. Verification result summary

Every load-bearing technical claim in the document set was confirmed against
code. In particular:

- **Positional source join (F-01 / R-06 / R-02 / P0-003).** Confirmed on the
  live path: `save_research_output()` compacts survivors
  (`runner/run_key_digest_research_workers.py:1294-1311`) while
  `classify_retained_sources()` joins the unfiltered `source_documents` to
  the compacted `saved_names` by raw index (`:1166`, `:1179-1180`), wired at
  `:1343`. Verification also surfaced a **second latent defect** the original
  reports missed — the producer iterates `output.source_markdown` while the
  consumer iterates `output.result.source_documents`, two different
  collections — now added to the affected findings.
- **Policy divergence (F-02 / D-019 / P0-010).** Confirmed verbatim. The
  two-source floor exists only as LLM reviewer prompt text
  (`main.py:1330-1341`); the deterministic merge gate (`conejo_validate.sh`)
  checks four filenames by path existence plus one corruption regex, states
  "`sources/` is NOT universal … do NOT require it", and auto-merges via
  `gh pr merge --squash`. The site's methodology page
  (`src/pages/methodology.astro:36`) promises the stronger floor publicly.
- **Retention gate (F-03 / R-07).** Confirmed: `retention_gate()`
  (`runner/source_classify.py:400-421`) says "Nothing here judges
  topicality"; `_MIN_RETAINED_CHARS = 200`; probe-side `_MIN_DOC_CHARS =
  1500` and `_PROBE_DOC_CHARS = 60_000` truncation confirmed
  (`runner/legal_probe.py:723`, `:740`, `:811`).
- **Domain-derived source kinds (F-03 / P0-017A).** Confirmed:
  `_DOMAIN_KINDS` keys on host suffix (courtlistener.com / uscourts.gov →
  caselaw). Nuance: a `_PATH_RULES` table exists and runs first, but it has
  no CourtListener rules and never addresses opinion-versus-filing, so the
  findings stand as written.
- **eCFR interstitial handling (F-09 / F-11).** Confirmed functionally.
  Precision note: the blocked-page check (`looks_blocked()`,
  `_BLOCK_MARKERS`) lives in the shared `fetch_probe_documents` path for all
  channels, not in an eCFR-specific branch; `_fetch_ecfr()` itself only
  queries the search API. The eCFR versioner-API gap is confirmed still open
  in the runner's own TODO.
- **Version skew (F-07 / P0-007).** Confirmed: `RUNNER_VERSION = "0.4.0"`
  at `:57` versus `docker-compose.yml:100` image `0.4.17`, whose comment
  block narrates every tag 0.4.1→0.4.17 while the constant never moved.
- **Manifest incompleteness (F-06 / R-05 / P0-006).** Confirmed:
  `build_manifest()` (`runner/run_manifest.py:96-142`) hashes only the
  passed file list; the caller passes only current-run records, so prior-run
  files fall outside the inventory.
- **v3 ledger (D-01, D-023).** Confirmed exactly: `issues_v3.jsonl` has
  137,139 lines and `n_items` sums to 156,802.
- **Missing FOLIO build manifest (S-07 / P1-011).** Confirmed: only
  `folio_build_manifest.example.json` exists; the real manifest was never
  generated, so nothing in the repo pins the FOLIO commit or source digest
  for the shipped ledger.
- **LLM-judge scores (F-01 / F-04).** Confirmed exactly (3.4 / 5.2 / 4.4 /
  4.1 over 40 bundles, seed 20260728). Verification added a stronger fact
  the reports had omitted: the prior sustained stage scored higher on every
  axis (5.3 / 5.8 / 5.1 / 5.2) — the current stage is a measured regression,
  attributed in the runner changelog to prioritizing proxy-pool source
  acquisition over honesty/consistency infrastructure. Now cited in both
  audits.
- **Purge manifest (C-13 / D-036).** Confirmed: 993 data rows; corroborated
  by the site repo commit "After purge for sources with 1 or less items".
- **Test-suite architecture (F-08 / F-12 / P1-021).** Confirmed: 845 test
  files, 793 named `test_pr<N>_adversarial_review.py`, 808 referencing the
  corpus tree via repo-relative paths that pin exact bytes and frontmatter
  literals. (An independent runner-TODO measurement at a different commit
  reports 3,364 passed / 463-of-469 per-PR failing files versus this set's
  3,411 / 455 — different commits, same magnitude; not a contradiction.)
- **Site-side claims.** All confirmed against the working tree:
  route-derived IRIs (`src/lib/skos.ts:22-24`), hard-coded `"en"`
  (`:30-32`), structural parent injected into `skos:broader` (`:93-96`),
  mapping export limited to close/related/broad (`:150-169`),
  `definition ?? description` fallback (`:124`), `historical_labels`
  exported as `skos:hiddenLabel` (`:121-123`), permissive `.passthrough()`
  schemas and a rights-free source schema (`src/content.config.ts`,
  `src/loaders/sources.ts`), private-sibling corpus default and
  `SOURCE_CHUNK_BYTES = 200_000` (`src/corpus.config.ts`), 3-minute
  corpus-less CI (`.github/workflows/ci.yml`), no test/coverage script
  (`package.json`), and the README licensing paragraph.

## 2. Corrections applied to the documents (2026-07-30)

1. **all-generated audit — internal contradiction fixed.** The
  generation-profile narrative claimed "every Markdown URL exactly matched a
  retained source URL" directly beneath a table stating 63 of 75 (84%);
  corrected to the measured 63/75.
2. **Agreement statistic specified.** Every reviewer-agreement threshold
  (≥0.80 in both audits, the all-generated TODO, and its quality
  definition; ≥0.85 for mapping review) now names a chance-corrected
  statistic (Cohen's κ / Krippendorff's α) — raw percent agreement is
  explicitly not acceptable.
3. **Statistical acceptance rules added.** Both audits now require
  thresholds to be met by the lower bound of the pre-registered confidence
  interval, and note the rule of three (zero critical errors in *n* samples
  bounds the true rate only to ≈3/*n* at 95% confidence).
4. **Proxy/token wording corrected (from-scratch F-10).** The token is not
  "withheld": it is configured, deliberately not sent on proxied clients
  (`runner/legal_probe.py:55-88`), and spent as a last-resort 429 fallback.
  The substantive finding — proxy rotation to defeat per-IP limits — stands
  and is now quoted from the code itself.
5. **Wrong-function citation fixed (all-generated FOLIO S-09).**
  `key_digest/skos_okf.py:249-290` pointed at `parse_frontmatter_block()`;
  the verifier `verify_legal_issue_frontmatter()` is at `:289-319` (checked
  at the pinned commit). Citation now names both.
6. **Second positional-join defect added** to F-01 (from-scratch audit),
  R-06 (from-scratch proposals), R-02 (all-generated proposals), and P0-003
  (all-generated TODO).
7. **Stage-regression evidence added** to F-04 (from-scratch audit) and
  F-01 (all-generated audit).
8. **`skos:hiddenLabel` conflation evidence added** to both FOLIO documents:
  the current exporter emits `historical_labels` as hidden labels, exactly
  the conflation the label profile prohibits.
9. **AGENTS.md heap figures corrected** to match `package.json` (24 GB
  build/dev/preview/sync; 12 GB deploy).

## 3. Drift since the 2026-07-29 measurement cutoff

These document statements were true at the cutoff but no longer describe the
current trees; the documents' dated snapshots remain valid as measurements.

- **The site evidence pin is unresolvable.** Every document pins site commit
  `3e49d34387d2d5ce20930cc158d01dc5c725b071`; the public site repository's
  history has since been squashed to three commits, so that pin no longer
  resolves. The runner pin `265a8610` still resolves (now 155 commits behind
  a HEAD that is actively generating new issues, so the corpus has grown
  past the measured 1,705 bundles).
- **`npm run lint` now exits 0** — but the `console.warn` remains at
  `src/lib/corpus.ts:88`. The lint toolchain changed (oxlint config), not
  the code. Whether `no-console` is still policy needs an explicit decision;
  a gate that went green because it got weaker is the policy-parity failure
  mode F-02 warns about.
- **`npm run check` no longer OOMs — because it is a different command.**
  The script is now `ultracite check` (style lint; exits 1 with 453 errors),
  not the corpus-loading `astro check` that exited 134 near a 4 GB heap.
  The original type-check gap is now unexercised rather than fixed.
- **`npm run format:check` fails on 4 files**, down from 24.
- **Build heap raised**: `build`/`dev`/`preview`/`sync` now use
  `--max-old-space-size=24576`; only `deploy` retains 12288 — consistent
  with a corpus that has kept growing.

## 4. Protocol rules adopted so reports stay verifiable

1. **Pin resolvable evidence.** An evidence snapshot must cite a commit that
  the published history will still resolve; where history may be rewritten,
  record the tree hash (`git rev-parse HEAD^{tree}`) and archive the
  measurement scripts and raw outputs alongside the report.
2. **Separate cutoff facts from live facts.** Statements measured at a
  cutoff are dated measurements; anything presented as current state must be
  re-measured at publication time. Re-verify both before relying on either.
3. **Cite the function, not just the line range.** Line numbers drift;
  citations name the symbol and the range, and decisive ranges are checked
  at the pinned commit, not at HEAD.
4. **Never accept a green gate as a fixed defect.** When a check passes
  after a toolchain or script change, verify the underlying code changed;
  otherwise record it as gate drift.
5. **Pre-register statistics precisely.** Thresholds name the statistic
  (chance-corrected agreement, CI-lower-bound acceptance) and the
  sample-size logic (rule of three for zero-error claims) before evaluation.
6. **No unpiped exit codes.** Build and check outcomes are read from
  unpiped exit codes plus log-file inspection (`AGENTS.md` rule), never from
  the tail of a pipeline.

## Verified documents

- [all-generated: research audit](all-generated-2026-07-29/2026-07-29-RESEARCH_METHOD_AUDIT.md)
- [all-generated: runner proposals](all-generated-2026-07-29/2026-07-29-RUNNER_V3_PROPOSALS.md)
- [all-generated: architecture](all-generated-2026-07-29/2026-07-29-ARCHITECTURE_FOLIO_ALIGNED.md)
- [all-generated: FOLIO/SKOS](all-generated-2026-07-29/2026-07-29-FOLIO_SKOS.md)
- [all-generated: atomic plan](all-generated-2026-07-29/2026-07-29-TODO.md)
- [from-scratch: research audit](from-scratch-2026-07-29/2026-07-29-RESEARCH_METHOD_AUDIT.md)
- [from-scratch: runner proposals](from-scratch-2026-07-29/2026-07-29-RUNNER_V3_PROPOSALS.md)
- [from-scratch: architecture](from-scratch-2026-07-29/2026-07-29-ARCHITECTURE_FOLIO_ALIGNED.md)
- [from-scratch: FOLIO/SKOS](from-scratch-2026-07-29/2026-07-29-FOLIO_SKOS.md)
- [from-scratch: implementation ledger](from-scratch-2026-07-29/2026-07-29-TODO.md)
