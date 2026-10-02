# Duplicates, leaked reasoning, and the taxonomy core — findings log, 2026-10-02

Append-only working log for the 2026-10-02 clean-up. Newest entries at the
bottom. Every number names how it was measured. `runner` = the private
`key-digest-runner` repo (corpus + taxonomy source); `site` = this repo.

Measured against `runner` `main` at `26ef1f2fb5` and `site` `main` at `7c10988`.

## 1. Where the directories come from

- The corpus is not in this repo. It is `runner/key_digest/american_legal_digest/okf`
  (`CORPUS_DIR` in `src/corpus.config.ts`).
- Every bundle directory is created by `runner/key_digest/get_topic.py
--materialize`, which turns one row of `key_digest/issues_v3.jsonl` into a
  folder: `areas_of_law_path` minus the `AREAS OF LAW` marker, each segment
  passed through `normalize()`. **`issues_v3.jsonl` is the source that creates
  the directories.**
- `issues_v3.jsonl` is itself derived (`build_issues_v3.py`) from
  `key_digest_v3.jsonl`, which is not vendored and is not on this machine.
  The upstream classifier lives in `open-taxonomy-legal`; its policy is
  exact-match dedup of _items_ only. Issue-level duplicates are therefore
  never collapsed upstream — they have to be merged, not deleted, downstream.

## 2. Corpus shape today

Walk of `okf/` plus every `run.json` (scratch script `scan.py`):

| Fact                                         | Value                                   |
| -------------------------------------------- | --------------------------------------- |
| Bundle directories                           | 11,988                                  |
| … with `run.json` (v3, carry an `issue_id`)  | 11,915                                  |
| … without (legacy v1, pre-provenance)        | 73, in 9 ALL-CAPS top-level directories |
| Top-level directories                        | 44 (35 v3 areas + 9 legacy)             |
| Rows in `issues_v3.jsonl`                    | 137,139 (36 areas)                      |
| Issue ids shipped more than once             | 0                                       |
| Bundles not at the folder their row computes | 0                                       |
| Folder collisions between rows               | 0                                       |

So the mechanical layer is sound: one issue id, one folder. The duplication is
semantic, and it is in the taxonomy.

## 3. The duplicate factory is the first local heading

Each `areas_of_law_path` is a FOLIO-derived Title-Case prefix (one or two
levels — 90 distinct prefixes, matching the 90 distinct `folio.area` anchors)
followed by ALL-CAPS headings that the classifier generated freely per treatise
section.

| Fact                                                         | Value                         |
| ------------------------------------------------------------ | ----------------------------- |
| Distinct FOLIO prefixes                                      | 90                            |
| Distinct first ALL-CAPS headings under them                  | 26,113                        |
| … used by exactly one issue                                  | ~17,000                       |
| `(parent label, label)` pairs carried by more than one issue | 3,168 clusters / 6,954 issues |
| Normalised labels shared by more than one issue              | 13,423 labels / 39,634 issues |

Example, `Corporate Law` (no FOLIO child): `FORMATION AND ORGANIZATION` (232),
`FORMATION AND INCORPORATION` (123), `CORPORATE FORMATION AND ORGANIZATION`
(30), `CORPORATE EXISTENCE AND FORMATION` (17) — four spellings of one node —
and `MUNICIPAL POWERS AND FUNCTIONS` (75), which belongs to `Municipal Law`.
The same issue label then lands under each spelling and is researched once per
spelling.

Among **shipped** bundles (`clusters.py`):

| Signal                                             | Clusters | Bundles |
| -------------------------------------------------- | -------- | ------- |
| Same parent label + same label                     | 29       | 58      |
| Same area + same label                             | 252      | 545     |
| Same label, any area                               | 377      | 886     |
| + same token set / near-identical label, same area | 511      | 1,206   |

Not every cluster is a duplicate (`GENERAL PRINCIPLES` ×23 is 23 different
subjects); each cluster is being adjudicated before anything is removed.

## 4. Leaked reasoning is mostly untagged

Tag search over non-source markdown (`rg`): `<think>` 0 files, `<thinking>` 0,
`<thought>` 136 (133 of them audit files that quote the tag while describing a
past clean-up; 3 digests), `<tool_call>` 14, `<function_calls>` 2,
`<update_plan>` 1. A tag rule alone would report the corpus clean.

Using the proxy "the digest opens with a block of text instead of a heading"
(`leak.py`, all 12,008 digest files):

| Fact                                                                           | Value                     |
| ------------------------------------------------------------------------------ | ------------------------- |
| Digests whose first body line is not a heading                                 | 623                       |
| … opening with first-person / pipeline prose                                   | 153 + most of 168 "other" |
| … opening with a bold "Key observation / Research plan / Topic analysis" block | 113                       |
| … opening mid-table (the heading and table header are gone)                    | 168                       |
| … opening with a numbered plan                                                 | 21                        |
| Digests with no heading at all                                                 | 42                        |
| Digests under 3,000 body characters                                            | 36                        |
| Bundles holding more than one digest file                                      | 8                         |
| Flagged for review after adding planning phrases, scaffold headings, tags      | 1,169 (9.7%)              |

Frontmatter is clean: no title, `pref_label`, description, definition or scope
note is oversized (max title 103 chars). The leak is in the body.

Several openings admit that the retained sources are about something else
("The injected sources are all 36 CFR provisions governing Forest Service
planning…"). Those are recorded separately from pure process chatter, because
the first is an evidence problem and the second is cosmetic.

## 5. Operating constraints found on the way

- `runner` has a live review fleet (`key-digest-review.service`, 18 workers)
  that lists **every** open non-draft PR and merges or closes it. Clean-up PRs
  are opened as **drafts** so a person decides.
- The fleet executes `main.py` out of the `runner` main checkout. That checkout
  is never switched off `main`; all clean-up branches are built in a separate
  worktree.

## 6. Where this stopped (2026-10-02)

Measurement only. **Nothing was removed, edited, branched or pushed in either
repo**; no PR exists yet. This file is uncommitted on `site` `main`.

Sixteen review agents were launched and then stopped minutes later when the
session hit its usage limit, so their output is partial or absent and none of
it has been checked. Inputs they were working from are in the session
scratchpad (`/tmp/claude-1000/-home-arthrod-workspace-digest-law-us/98336f92-…/scratchpad/`,
a tmpfs — it does not survive a reboot):

- `dup_shard_{0,1,2}.json` — 511 candidate duplicate clusters / 1,206 bundles
- `legacy_bundles.json` — the 73 legacy bundles with same-label v3 issues
- `leak_shard_{0..5}.json` — 1,169 flagged digests with line-numbered extracts
- `spine_in/*.json`, `spine_group_{0..3}.txt` — first-heading lists per prefix
- `folio/used_{area,objective}_anchors.json` — anchors in use per prefix
- `scan.py`, `leak.py`, `clusters.py`, `leakshards.py` — the scripts behind
  every number above; rerun from `runner/key_digest/` to regenerate

Not measured: the rate-limit (429) scan over `sources/` was still running and
was stopped without a result.

Still to do, in order: adjudicate the duplicate clusters and legacy bundles;
adjudicate the flagged digests (strip / repair / expire); audit the FOLIO
anchors and the six `x-digest:` placeholders; build the canonical first-heading
vocabulary per prefix; then the tooling (issue-merge overlay applied by
`build_issues_v3.py`, a lint rule for untagged reasoning, a done-check so a
removed issue is not researched again) and the draft PRs, one per removal.

## 7. What was implemented (2026-10-02, second session)

All `runner` changes are draft PRs, built in separate worktrees; the runner
main checkout was never switched or edited.

**Tooling (runner, `cleanup/taxonomy-dedup-leak-tooling`)** — `okf_lint.py`
gains digest-only rules (must open with a heading; no process scaffold
headings; no narration; no tool-call markup) and a `strip_leaked_reasoning`
normalizer that the worker applies at write time; `taxonomy_overlay.py`
(merges + heading aliases, applied by `build_issues_v3.py`);
`find_duplicate_issues.py`; `get_topic.py` skips shipped and merged-away
issues and pins `--materialize` by `--issue-id`. 71 new tests.

**Leaked reasoning (runner, `cleanup/corpus-leaked-reasoning`)** — measured
with the new linter over all 237k markdown files: 1,296 digests failed before
repair, 52 after. 1,941 files repaired (1,385 digests); 52 bundles expired
with `docs/2026-10-02-purge-leaked-reasoning-manifest.tsv` (0.4% of bundles,
far under the 20% allowance). Every removed span was audited by its leading
heading; legal "Step N" headings (Rule 403 balancing, proof-of-claim steps)
are kept and pinned by tests.

**Duplicates (runner, 92 × `cleanup/dedup/*`)** — one draft PR per removed
bundle: the 92 high-confidence removals from the 175 adjudicated clusters,
each reviewed by path. Nine pairs were flipped to keep the bundle with clearly
more retained sources (2–10×). Each PR removes the bundle's own files (nested
child bundles are kept) and adds its merge record.

**The source (runner, `cleanup/taxonomy-source-overlay`)** —
`issues_v3.jsonl` 137,139 → 136,992: 92 merges, 407 heading aliases
respelling 1,320 unshipped rows, 55 resulting identical rows merged. Shipped
issues never move.

**Ontology** — every FOLIO anchor in use resolves and sits in its facet; the
six `x-digest:` areas have no FOLIO Area-of-Law class and correctly stay
placeholders (nearest classes are in other facets). Audit in runner
`docs/2026-10-02-taxonomy-overlay-and-folio-audit.md`.

**Site (this repo)** — concept ids of merged duplicates now 301 to the
survivor (`replacedBy`, `id-map.json` `replaced`) instead of 410. Registry:
3 merged ids redirect, 16 merged ids whose survivor was never minted and 1
expired id are retired; the other 124 removed bundles were never minted.

**429 / rate-limit captures** — see §8.

Not done: the remaining 336 duplicate clusters and the 73 legacy bundles (no
verdicts); semantic heading synonyms and misplaced headings (need an
editor); proposing the six areas upstream to FOLIO.
