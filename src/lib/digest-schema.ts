import { z } from "astro/zod";

/** A frontmatter list that tolerates two hand-editing slips. Researcher PRs
 *  occasionally land `do_not_use_for: "one sentence"` where a list belongs
 *  (runner #22541), or a doubled dash, `- - "item"`, that YAML reads as a
 *  nested list (NOTICE_FROM_TITLE_DEEDS_NOT_BETWEEN_PARTIES). Each was one
 *  digest out of 13.6k and each killed a cold build 30 minutes into content
 *  sync. A lone string is wrapped and nested lists are flattened, which is
 *  what the author meant; the views join these with "; ". Anything else that
 *  is not a list of strings still fails, and scripts/check-digest-
 *  frontmatter.ts finds such entries in seconds instead of mid-build. */
const toList = (v: unknown): unknown => {
    if (typeof v === "string") {
      return [v];
    }
    return Array.isArray(v) ? v.flat(Infinity) : v;
  },
  // oxlint-disable-next-line eslint/sort-vars -- each schema is built from the one before it
  stringList = z.preprocess(toList, z.array(z.string())).default([]),
  /** SKOS `legal_issue` frontmatter carried by every digest. Deliberately
   *  loose: 69 pre-provenance bundles (June 2026) predate some fields. */
  // oxlint-disable-next-line eslint/sort-vars -- built from stringList, so it must follow it
  digestSchema = z
    .object({
      alt_labels: stringList,
      broader: stringList,
      created: z.coerce.string().optional(),
      definition: z.string().default(""),
      description: z.string().default(""),
      do_not_use_for: stringList,
      historical_labels: stringList,
      id: z.string().optional(),
      issue_id: z.string().optional(),
      /** BCP 47 tag for this record's literals; absent on every 2026 digest,
       *  so the exporter falls back to the scheme language (P1-014I). */
      language: z.string().optional(),
      legal_relations: z
        .object({
          defenseTo: z.array(z.string()).default([]),
          procedureFor: z.array(z.string()).default([]),
          remedyFor: z.array(z.string()).default([]),
        })
        .partial()
        .optional(),
      mappings: z.record(z.string(), z.any()).optional(),
      modified: z.coerce.string().optional(),
      narrower: stringList,
      notation: z.string().optional(),
      objectives_path: stringList,
      okf_version: z.string().optional(),
      pref_label: z.string().optional(),
      related: stringList,
      scheme: z.string().optional(),
      scope_note: z.string().default(""),
      source_profile: z.string().optional(),
      status: z.string().optional(),
      timestamp: z.coerce.string().optional(),
      title: z.string().optional(),
      type: z.string().optional(),
      version: z.string().optional(),
    })
    .passthrough();

export { digestSchema };
