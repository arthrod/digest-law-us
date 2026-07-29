import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { remarkStripFmEcho } from "./src/lib/remark-strip-fm-echo";

// https://astro.build/config
export default defineConfig({
  site: "https://digest.law",
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
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
