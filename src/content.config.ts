import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { sourcesLoader } from "@/loaders/sources";
import { CORPUS_DIR } from "@/corpus.config";

/** Keep raw corpus paths as ids — the URL scheme derives from them. */
<<<<<<< HEAD
const rawId = ({ entry }: { entry: string }) =>
  entry.replace(/\.(md|mdx|json)$/, "");
=======
const rawId = ({ entry }: { entry: string }) => entry.replace(/\.(md|mdx|json)$/, "");
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

/** SKOS `legal_issue` frontmatter carried by every digest. Deliberately
 *  loose: 69 pre-provenance bundles (June 2026) predate some fields. */
const digestSchema = z
  .object({
    okf_version: z.string().optional(),
    type: z.string().optional(),
    id: z.string().optional(),
    notation: z.string().optional(),
    title: z.string().optional(),
    pref_label: z.string().optional(),
    alt_labels: z.array(z.string()).default([]),
    historical_labels: z.array(z.string()).default([]),
    description: z.string().default(""),
    definition: z.string().default(""),
    scope_note: z.string().default(""),
    do_not_use_for: z.array(z.string()).default([]),
    scheme: z.string().optional(),
    status: z.string().optional(),
    broader: z.array(z.string()).default([]),
    narrower: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    legal_relations: z
      .object({
        defenseTo: z.array(z.string()).default([]),
        remedyFor: z.array(z.string()).default([]),
        procedureFor: z.array(z.string()).default([]),
      })
      .partial()
      .optional(),
    mappings: z.record(z.string(), z.any()).optional(),
    version: z.string().optional(),
    created: z.coerce.string().optional(),
    modified: z.coerce.string().optional(),
    issue_id: z.string().optional(),
    objectives_path: z.array(z.string()).default([]),
    timestamp: z.coerce.string().optional(),
    source_profile: z.string().optional(),
  })
  .passthrough();

const digests = defineCollection({
  loader: glob({
    pattern: [
      "**/*.md",
      "!**/index.md",
      "!**/timestamp.md",
      "!**/caselaw_index.md",
      "!**/statutory_index.md",
      "!**/_source_snippet_audit.md",
      "!**/sources/**",
    ],
    base: CORPUS_DIR,
    generateId: rawId,
  }),
  schema: digestSchema,
});

const indexSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    description: z.string().default(""),
    issue_id: z.string().optional(),
    folio_area: z.string().optional(),
    folio_objective: z.string().optional(),
    source_profile: z.string().optional(),
    source_counts: z
      .object({
        caselaw: z.number().optional(),
        statutory: z.number().optional(),
        secondary: z.number().optional(),
      })
      .partial()
      .optional(),
    timestamp: z.coerce.string().optional(),
  })
  .passthrough();

const caselaw = defineCollection({
  loader: glob({
    pattern: "**/caselaw_index.md",
    base: CORPUS_DIR,
    generateId: rawId,
  }),
  schema: indexSchema,
});

const statutory = defineCollection({
  loader: glob({
    pattern: "**/statutory_index.md",
    base: CORPUS_DIR,
    generateId: rawId,
  }),
  schema: indexSchema,
});

const audits = defineCollection({
  loader: glob({
    pattern: "**/_source_snippet_audit.md",
    base: CORPUS_DIR,
    generateId: rawId,
  }),
  schema: z
    .object({
      type: z.string().optional(),
      title: z.string().optional(),
      description: z.string().default(""),
      resource: z.string().optional(),
      timestamp: z.coerce.string().optional(),
    })
    .passthrough(),
});

/** run.json provenance manifests (1,552+ bundles; absent = pre-provenance) */
const runs = defineCollection({
  loader: glob({
    pattern: "**/run.json",
    base: CORPUS_DIR,
    generateId: rawId,
  }),
  schema: z
    .object({
      manifest_version: z.number().optional(),
      issue: z.record(z.string(), z.any()).optional(),
      run: z
        .object({
          started_at: z.string().optional(),
          finished_at: z.string().optional(),
          attempts: z.number().optional(),
          duration_seconds: z.number().optional(),
          visited_urls: z.number().optional(),
          retained_sources: z.number().optional(),
        })
        .partial()
        .optional(),
      config: z.record(z.string(), z.any()).optional(),
      probe: z.record(z.string(), z.any()).optional(),
      evidence: z.record(z.string(), z.any()).optional(),
      // Newer manifests: array of {path, sha256, bytes}. Oldest (June 2026):
      // a role→filename map. Kept loose; consumers must check the shape.
      files: z.any().optional(),
    })
    .passthrough(),
});

/** Retained source documents — metadata + chunk spans only (see loader). */
const sources = defineCollection({
  loader: sourcesLoader(CORPUS_DIR),
  schema: z.object({
    bundle: z.string(),
    slug: z.string(),
    relFile: z.string(),
    title: z.string(),
    description: z.string().default(""),
    resource: z.string().default(""),
    tags: z.array(z.string()).default([]),
    retained: z.string().default(""),
    bytes: z.number(),
    chars: z.number(),
    parts: z.number(),
    spans: z.array(z.object({ start: z.number(), end: z.number() })),
  }),
});

export const collections = { digests, caselaw, statutory, audits, runs, sources };
