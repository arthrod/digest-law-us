/**
 * Metadata loader for per-bundle audit files.
 *
 * The audits are the single largest markdown collection in the corpus
 * (~93 MB across ~3.6k bundles, and growing with it). Astro's glob loader
 * would keep both the raw body and the rendered HTML for every one of them
 * in the content store, which is held in memory for the whole build and
 * serialized to a single string — the two limits this project has already
 * hit, first as `Invalid string length` and then as an out-of-memory abort
 * during bundling.
 *
 * So audits follow the same rule the retained sources have followed since
 * the beginning (see `./sources.ts`): only metadata enters the store, and
 * `AuditView` renders the file at build time through the shared markdown
 * pipeline. Nothing about the published page changes — the audit is still
 * rendered verbatim, still indexed by Pagefind.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Loader } from "astro/loaders";
import matter from "gray-matter";

import { PREVIEW_MODE } from "@/corpus.config";
import { previewBundles } from "@/lib/preview";

const AUDIT_FILE = "_source_snippet_audit.md";

export function auditsLoader(corpusDir: string): Loader {
  return {
    async load({ store, logger, config, parseData, generateDigest }) {
      const root = path.resolve(fileURLToPath(config.root), corpusDir),
       listing = await fs.readdir(root, { recursive: true }),
       preview = PREVIEW_MODE ? await previewBundles(root) : null,

       files = listing
        .map((rel) => rel.replaceAll("\\", "/"))
        .filter((rel) => rel.endsWith(`/${AUDIT_FILE}`))
        .filter(
          (rel) =>
            preview === null ||
            preview.has(rel.slice(0, -(AUDIT_FILE.length + 1)))
        )
        .toSorted();

      store.clear();
      let count = 0;

      for (const rel of files) {
        const raw = await fs.readFile(path.join(root, rel), "utf8");
        let fm: Record<string, unknown>;
        try {
          ({ data: fm } = matter(raw));
        } catch (error) {
          // A malformed frontmatter block must not kill a multi-hour build:
          // keep the entry, log loudly, never drop it (same rule as sources).
          logger.warn(`Broken frontmatter in ${rel}: ${error}`);
          fm = {};
        }

        const id = rel.replace(/\.md$/u, ""),
         data = await parseData({
          data: {
            description:
              typeof fm.description === "string" ? fm.description : "",
            relFile: rel,
            resource: typeof fm.resource === "string" ? fm.resource : "",
            timestamp: fm.timestamp ? String(fm.timestamp) : "",
            title: typeof fm.title === "string" ? fm.title : "",
          },
          id,
        });
        store.set({ data, digest: generateDigest(data), id });
        count += 1;
      }
      logger.info(`Indexed ${count} audits (metadata only)`);
    },
    name: "ald-audits",
  };
}
