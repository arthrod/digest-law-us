import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

import { CORPUS_DIR } from "@/corpus.config";
import { sourcesLoader } from "@/loaders/sources";

/** Keep raw corpus paths as ids — the URL scheme derives from them. */
const rawId = ({ entry }: { entry: string }) =>
  entry.replace(/\.(?<ext>md|mdx|json)$/u, "");

/** SKOS `legal_issue` frontmatter carried by every digest. Deliberately
 *  loose: 69 pre-provenance bundles (June 2026) predate some fields. */
const digestSchema = z
  .object({
    alt_labels: z.array(z.string()).default([]),
    broader: z.array(z.string()).default([]),
    created: z.coerce.string().optional(),
    definition: z.string().default(""),
    description: z.string().default(""),
    do_not_use_for: z.array(z.string()).default([]),
    historical_labels: z.array(z.string()).default([]),
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
    narrower: z.array(z.string()).default([]),
    notation: z.string().optional(),
    objectives_path: z.array(z.string()).default([]),
    okf_version: z.string().optional(),
    pref_label: z.string().optional(),
    related: z.array(z.string()).default([]),
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

const digests = defineCollection({
  loader: glob({
    base: CORPUS_DIR,
    generateId: rawId,
    pattern: [
      "**/*.md",
      "!**/index.md",
      "!**/timestamp.md",
      "!**/caselaw_index.md",
      "!**/statutory_index.md",
      "!**/_source_snippet_audit.md",
      "!**/sources/**",
    ],
  }),
  schema: digestSchema,
});

const indexSchema = z
  .object({
    description: z.string().default(""),
    folio_area: z.string().optional(),
    folio_objective: z.string().optional(),
    issue_id: z.string().optional(),
    source_counts: z
      .object({
        caselaw: z.number().optional(),
        secondary: z.number().optional(),
        statutory: z.number().optional(),
      })
      .partial()
      .optional(),
    source_profile: z.string().optional(),
    timestamp: z.coerce.string().optional(),
    title: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const caselaw = defineCollection({
  loader: glob({
    base: CORPUS_DIR,
    generateId: rawId,
    pattern: "**/caselaw_index.md",
  }),
  schema: indexSchema,
});

const statutory = defineCollection({
  loader: glob({
    base: CORPUS_DIR,
    generateId: rawId,
    pattern: "**/statutory_index.md",
  }),
  schema: indexSchema,
});

const audits = defineCollection({
  loader: glob({
    base: CORPUS_DIR,
    generateId: rawId,
    pattern: "**/_source_snippet_audit.md",
  }),
  schema: z
    .object({
      description: z.string().default(""),
      resource: z.string().optional(),
      timestamp: z.coerce.string().optional(),
      title: z.string().optional(),
      type: z.string().optional(),
    })
    .passthrough(),
});

/** run.json provenance manifests (1,552+ bundles; absent = pre-provenance) */
const runs = defineCollection({
  loader: glob({
    base: CORPUS_DIR,
    generateId: rawId,
    pattern: "**/run.json",
  }),
  schema: z
    .object({
      config: z.record(z.string(), z.any()).optional(),
      evidence: z.record(z.string(), z.any()).optional(),
      // Newer manifests: array of {path, sha256, bytes}. Oldest (June 2026):
      // a role→filename map. Kept loose; consumers must check the shape.
      files: z.any().optional(),
      issue: z.record(z.string(), z.any()).optional(),
      manifest_version: z.number().optional(),
      probe: z.record(z.string(), z.any()).optional(),
      run: z
        .object({
          attempts: z.number().optional(),
          duration_seconds: z.number().optional(),
          finished_at: z.string().optional(),
          retained_sources: z.number().optional(),
          started_at: z.string().optional(),
          visited_urls: z.number().optional(),
        })
        .partial()
        .optional(),
    })
    .passthrough(),
});

/** Retained source documents — metadata + chunk spans only (see loader). */
const sources = defineCollection({
  loader: sourcesLoader(CORPUS_DIR),
  schema: z.object({
    bundle: z.string(),
    bytes: z.number(),
    chars: z.number(),
    description: z.string().default(""),
    parts: z.number(),
    relFile: z.string(),
    resource: z.string().default(""),
    retained: z.string().default(""),
    slug: z.string(),
    spans: z.array(z.object({ end: z.number(), start: z.number() })),
    tags: z.array(z.string()).default([]),
    title: z.string(),
  }),
});

export const collections = {
  audits,
  caselaw,
  digests,
  runs,
  sources,
  statutory,
};
