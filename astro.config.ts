import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { remarkStripFmEcho } from "./src/lib/remark-strip-fm-echo";

/**
 * Preview builds (PREVIEW_BUNDLES / PREVIEW_PATHS — see src/corpus.config.ts)
 * write to dist-preview/ so a full 57k-page dist/ is never clobbered by a
 * ten-page style-iteration build.
 */
const previewMode =
  Boolean(Math.trunc(Number(process.env.PREVIEW_BUNDLES ?? ""))) ||
  Boolean(process.env.PREVIEW_PATHS?.trim());

// https://astro.build/config
export default defineConfig({
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
    incrementalBuild: true,
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
