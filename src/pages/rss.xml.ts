/**
 * The most recently revised digests, as RSS 2.0 (see src/lib/feed.ts).
 * public/_headers serves it as application/rss+xml.
 */
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

import { getCorpus } from "@/lib/corpus";
import {
  feedDigests,
  feedOptions,
  recentlyRevised,
  withLedes,
} from "@/lib/feed";

export const GET: APIRoute = async () => {
  const corpus = await getCorpus(),
    entries = withLedes(recentlyRevised(feedDigests(corpus)), corpus);
  return await rss(feedOptions(entries));
};
