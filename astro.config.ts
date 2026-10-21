import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { remarkStripFmEcho } from "./src/lib/remark-strip-fm-echo";

/**
 * previewMode: preview builds (PREVIEW_BUNDLES / PREVIEW_PATHS — see
 * src/corpus.config.ts)
 * write to dist-preview/ so a full 57k-page dist/ is never clobbered by a
 * ten-page style-iteration build.
 */
// prerenderWorkers: unset means all cores but one (Astro's default); a
// non-negative integer caps the pool, and 0 disables parallel prerendering.
// Anything else ("", "abc", 1.5) is treated as unset. See
// experimental.parallelPrerender below.
const prerenderWorkers = /^(?:0|[1-9]\d*)$/u.test(
    process.env.ASTRO_PRERENDER_WORKERS ?? ""
  )
    ? Number(process.env.ASTRO_PRERENDER_WORKERS)
    : undefined,
  previewMode =
    Boolean(Math.trunc(Number(process.env.PREVIEW_BUNDLES ?? ""))) ||
    Boolean(process.env.PREVIEW_PATHS?.trim());

// https://astro.build/config
export default defineConfig({
  /**
   * Preview builds get their own cache next to their own outDir, for two
   * reasons. The content store lives in cacheDir, and a preview build
   * narrows every glob — sharing the store would let a ten-page preview
   * evict the full corpus from it. The incremental-build manifest lives
   * there too, and it is invalidated whole on any config-hash change —
   * which flipping outDir between builds would otherwise cause on every
   * preview/full alternation.
   *
   * Both paths sit OUTSIDE node_modules, which is the whole point. Astro's
   * default cacheDir is ./node_modules/.astro, and at this corpus size that
   * cache is ~24.5 GB (a 79 MB incremental manifest, a 23 GB cached copy of
   * dist/, and a 1.5 GB content store) representing a ~25-hour build. Any
   * `rm -rf node_modules`, or a clean reinstall during a dependency bump,
   * silently destroys all of it and the next build starts cold. Nothing about
   * a cache of build OUTPUT belongs in a directory owned by the package
   * manager. Not `./.astro` either — that is Astro's generated-types
   * directory (content.d.ts, collections/).
   */
  build: {
    // Anything but a positive integer (unset, "", "abc", 0, 1.5) means 1.
    concurrency: /^[1-9]\d*$/u.test(process.env.BUILD_CONCURRENCY ?? "")
      ? Number(process.env.BUILD_CONCURRENCY)
      : 1,
  },
  cacheDir: previewMode ? "./.astro-cache-preview" : "./.astro-cache",
  experimental: {
    /**
     * The content store is written as one file by default, which means the
     * whole store is serialized into a single string. At this corpus size
     * that string exceeds what V8 can hold: builds died first as
     * `Invalid string length`, then — once the store shrank — as an
     * out-of-memory abort inside `JSON.stringify`, neither of which names
     * the store as the cause. `chunked` serializes one collection at a time
     * and writes it in 20 MB pieces, so peak string size is bounded by the
     * largest single collection rather than by the entire corpus.
     */
    collectionStorage: "chunked",
    // Env-switchable for A/B measurement. Neither this flag nor
    // build.concurrency appears in core/build/config-hash/input.js, so
    // toggling them cannot invalidate an incremental manifest.
    incrementalBuild: process.env.ASTRO_INCREMENTAL !== "0",
    /**
     * Astro 7.4: render static routes on worker threads, by default one per
     * CPU core but one (11 here). Generation concurrency becomes
     * workers x build.concurrency, and the incremental cache still applies —
     * canSkip() runs on the main thread before a path is handed to a worker
     * (core/build/generate.js), and the flag is not in
     * core/build/config-hash/input.js, so toggling it keeps the manifest.
     *
     * The ceiling is RAM, not cores: each worker imports the built app,
     * which loads the chunked content store and runs its own getCorpus()
     * (module-level memo, so nothing is shared across workers), on a 31 GB
     * machine whose main thread is already sized at a 24 GB heap. If a
     * build dies out of memory, cap the pool with ASTRO_PRERENDER_WORKERS=N
     * rather than turning the feature off; 0 disables it entirely.
     */
    parallelPrerender:
      prerenderWorkers === undefined
        ? true
        : prerenderWorkers > 0 && { workers: prerenderWorkers },
  },

  integrations: [sitemap()],
  markdown: {
    // Astro 7 defaults to the Sätteri processor and takes remark/rehype
    // plugins on the processor, not on `markdown` (the old keys still work
    // but warn). We stay on unified: the corpus needs remarkStripFmEcho,
    // and src/lib/render-md.ts renders source chunks through the same
    // pipeline. shikiConfig stays here — it is passed to the processor as
    // a shared option, not a unified() one.
    processor: unified({ remarkPlugins: [remarkStripFmEcho] }),
    shikiConfig: {
      defaultColor: false,
      themes: { dark: "night-owl", light: "min-light" },
      wrap: true,
    },
  },
  outDir: previewMode ? "./dist-preview" : "./dist",
  site: "https://digest.law",
  vite: {
    plugins: [tailwindcss()],
  },
});
