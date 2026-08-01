/**
 * Per-bundle provenance: the run.json manifest, republished verbatim at
 * /provenance/{topic-path}.json — the full machine log every digest's
 * provenance strip links to.
 */
import type { APIRoute, GetStaticPaths } from "astro";

import { getCorpus } from "@/lib/corpus";

export const getStaticPaths: GetStaticPaths = async () => {
  const corpus = await getCorpus();
  const paths = [];
  for (const node of corpus.nodeBySlugPath.values()) {
    if (!node.digest) {
      continue;
    }
    const run = corpus.runsByDir.get(node.dir);
    if (!run) {
      continue;
    }
    paths.push({
      params: { path: node.slugPath },
      props: { runData: run.data },
    });
  }
  return paths;
};

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.runData, null, 1), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
