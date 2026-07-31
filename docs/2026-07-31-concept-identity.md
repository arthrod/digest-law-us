# Concept identity and label profile — 2026-07-31

Decided and implemented in `digest-law-us` on 2026-07-31. Governs how public
concept identifiers are allocated and how labels are exported. Closes
[P1-001, P1-002, P1-014B, P1-014C (partly), P1-014I](all-generated-2026-07-29/2026-07-29-TODO.md)
and [S-01, S-02, S-04](all-generated-2026-07-29/2026-07-29-FOLIO_SKOS.md);
the remainder of the SKOS block stays PENDING in [the ledger](LEDGER.md).

## The finding that set the design

The plan documents' target RDF uses a corpus `issue_id`
(`digest:2b8aeb0b9919…`) as though it were opaque identity. It is not.
Measured against `key_digest/issues_v3.jsonl` (137,139 rows) on 2026-07-31:

- the label `INTENT` carries **four different UUIDs** under four different
  `areas_of_law_path` values;
- **every** UUID maps to exactly one label (137,139 ids, 0 ids with two
  labels), while 13,347 labels map to more than one id;
- the ids are UUIDv5 — deterministic over placement-bearing input, minted
  upstream of this repo.

So `issue_id` is a placement hash. Publishing it as identity would make public
IRIs change on exactly the event P1-001 exists to survive, while appearing to
satisfy the criterion. Coverage is also incomplete: 1,641 of 1,811 digests
carry one, and two ids are shared by two files each.

## Decision

Identity is **allocated here, once, and committed** —
`src/data/concept-ids.json`.

| Aspect             | Rule                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Public IRI         | `https://w3id.org/digest-law/concept/{id}` — 32 lowercase hex                                                                            |
| Allocation         | Random (UUIDv4 bits). Never derived from path, label, or corpus id                                                                       |
| Registry           | Append-only. An id is never reused and never reassigned (P1-014H)                                                                        |
| Rename / reparent  | Append the new route key to the existing record; `@id` does not move (P1-001)                                                            |
| Legacy IRIs        | Every concept still publishes `digest:legacyIri` — the route IRI it was previously cited under (P1-002)                                  |
| Corpus `issue_id`  | Kept as `digest:corpusIssueId`. Provenance, never identity                                                                               |
| Canonical notation | `skos:notation` = minted id, typed `idtype:concept-id`. The corpus dotted notation is a route artifact → `digest:pathNotation` (P1-014C) |
| `dct:identifier`   | The minted id in dashed UUID form                                                                                                        |
| Unminted routes    | Fall back to the legacy route IRI and are reported by `bun run ids:check` — a fallback, explicitly not stable identity                   |

Rebinding a moved concept is an **editorial act**. `bun run ids:mint` mints for
new paths and reports orphaned keys; it never guesses that a new path is an old
concept, because guessing would fabricate identity continuity.

State on 2026-07-31: 4,569 concepts minted, 1,638 carrying a corpus `issue_id`,
0 unminted, 0 integrity violations.

## Born fixed: the runner side

Retrofitting identity onto generated output only works until the next run, so
`key-digest-runner` now allocates it at generation time:

- `skos_okf.mint_concept_id()` allocates a 32-hex id; the rendered
  `legal_issue` frontmatter carries `concept_id` and `language: "en"` as
  required fields, and `verify_legal_issue_frontmatter` rejects a malformed
  id, a malformed BCP 47 tag, or overlapping label sets.
- `stamp_concept_identity()` writes identity onto frontmatter the researcher
  authored, **additively**. This matters: the existing repair path replaces the
  whole SKOS block with a skeleton, so letting a missing `concept_id` fail
  verification would have silently discarded the definition, scope note and
  labels the model actually wrote.
- Regeneration reads the `concept_id` already on disk and carries it forward
  (`run_key_digest_research_workers.py`, `repair_okf_bundle.py`). Re-running a
  topic does not re-mint its identity.
- Label sets are made pairwise disjoint at write time, both lists resolved
  together — deduplicating each field alone leaves a term that appears in both
  sitting in both.
- `PY_AI_RESEARCHER_PROMPT.md` documents `concept_id` as permanent public
  identity to be reproduced byte for byte and never invented, `language` as a
  BCP 47 tag, `issue_id` as placement-derived provenance rather than identity,
  the pairwise label-disjointness rule, the meaning of a historical label, and
  a bar on circular definitions.

The loop closes here: `bun run ids:mint` **adopts** a `concept_id` the runner
supplied instead of allocating a competing one, and refuses (loudly) a value
that is malformed or already bound to another concept.

State on 2026-07-31: 17 runner tests cover this, including reparenting under a
new notation, idempotent stamping, and a drift check between the two duplicated
`skos_okf.py` copies.

## Label and language profile

- **Historical labels are not `skos:hiddenLabel`.** Hidden labels are search
  aids; a historical label is a fact about the term's past. They now export as
  `digest:historicalLabel`. This removes the conflation the label profile
  prohibits (S-04); 293 digests carry historical labels.
- **One `skos:prefLabel` per language**, and prefLabel / altLabel /
  historicalLabel are pairwise disjoint after NFC + whitespace + case folding.
  Duplicates are dropped and reported rather than published (P1-014B).
- **Language tags are data-driven**: a record's own BCP 47 `language` wins;
  otherwise the scheme's principal language constant (`en`) applies. Digests
  generated from now on carry the field (the runner writes it); the **1,811
  already on disk do not**, so their literals still resolve through the
  fallback. Backfilling the existing corpus is unfinished P1-014I work.
- **Only natural language is tagged.** Identifiers, notations, dates and the
  publisher name are typed or bare (P1-014I).

## Placement is not hierarchy

The exporter previously injected the folder parent into `skos:broader` and the
folder children into `skos:narrower`. Placement is navigation; a broader
relation is an editorial claim. Structure now exports as
`digest:placementParent` / `digest:placementChild`, and SKOS hierarchy carries
only what the drafter asserted (S-02, P1-006).

Cost, measured before the change: of 1,811 digests, 1,787 carry exactly one
frontmatter `broader`, 24 carry none, and only **3** differ from the folder
parent. The published hierarchy is therefore substantially preserved, and what
remains is asserted rather than inferred.

## Still open, and visible in the export

- **P1-014E** — `skos:topConceptOf` is still inferred from folder roots. The
  profile requires an editorial decision per top concept; there is no reviewed
  list yet, so the inference stands and is flagged in the code.
- **P1-014A / R7-017** — the concept-scheme IRI is still the legacy route base
  `https://w3id.org/digest-law/us/`; stable scheme identity and immutable
  release identity are not yet separated.
- **P1-014G / R7-024** — none of the `w3id.org/digest-law/{concept,vocab,
datatype}/` namespaces redirect yet. The w3id configuration PR is unwritten,
  so these IRIs are stable names that do not yet dereference.
- **P1-014D / P1-014F** — hierarchy inverse/closure and mapping-direction
  validation (SHACL) are not implemented.

## Checks

```
bun test src        # 28 tests: rename/reparent identity, registry integrity,
                    # label disjointness, language fallback, placement split
bun run ids:check   # unminted concepts + registry integrity; non-zero on fail
bun run ids:mint    # allocate ids for new corpus concepts
```
