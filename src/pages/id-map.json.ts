/**
 * Concept id → current route, for the identity resolver.
 *
 * Emitted as a static asset so the Worker can answer `/id/{concept-id}`
 * without bundling the 1.7 MB registry: it fetches this once per isolate.
 *
 * The route published here is the LAST key in the record. Keys are appended
 * on rename or reparent and never removed, so the last one is the current
 * route and the earlier ones are history — the id itself never moves, which
 * is the whole point (P1-001, P1-002).
 */
import type { APIRoute } from "astro";

import { allConcepts } from "@/lib/concept-ids";

export const GET: APIRoute = () => {
  const routes: Record<string, string> = {};
  const retired: Record<string, string> = {};
  for (const record of allConcepts()) {
    const current = record.keys.at(-1);
    if (!current) {
      continue;
    }
    if (record.retired) {
      // Tombstone: the id stays resolvable forever and reports 410 Gone,
      // rather than 404 (which would imply it never existed) or a redirect
      // (which would imply it is still current).
      retired[record.id] = current;
      continue;
    }
    routes[record.id] = current;
  }
  return Response.json({ retired, routes, version: 1 });
};
