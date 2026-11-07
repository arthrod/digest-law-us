/**
 * Compact concept catalog for the public MCP server.
 *
 * The registry on disk is about 13 MB. The Worker must not bundle it.
 * `scripts/write-mcp-catalog.ts` writes this catalog to `dist/mcp-catalog.json`
 * after `astro build`, and the Worker fetches that asset once per isolate —
 * the same pattern as `/id-map.json`.
 *
 * This module imports nothing. The script is the only place that reads the
 * registry, so the Worker bundle stays small.
 */

export interface CatalogSource {
  id: string;
  keys: readonly string[];
  label: string;
  replacedBy?: string;
  retired?: string;
}

export interface CatalogConcept {
  id: string;
  label: string;
  /** Current route (the last key). Empty routes are omitted. */
  route: string;
  retired: boolean;
  /** Current route of the concept that absorbed this one, when merged. */
  successor?: string;
}

export interface Catalog {
  concepts: CatalogConcept[];
  version: 1;
}

export interface ListQuery {
  /** First path segment, or a longer route prefix. */
  area: string;
  includeRetired: boolean;
  limit: number;
  page: number;
}

const AREA_SPLIT = "/";

function currentRoute(keys: readonly string[]): string {
  return keys.at(-1) ?? "";
}

/**
 * Follow `replacedBy` to a live concept. A cycle, a missing id, or a chain
 * that ends on a tombstone yields no successor — the record stays a tombstone.
 */
function successorRoute(
  byId: ReadonlyMap<string, CatalogSource>,
  id: string
): string | undefined {
  const seen = new Set<string>();
  let record = byId.get(id);
  while (record?.replacedBy) {
    if (seen.has(record.id)) {
      return undefined;
    }
    seen.add(record.id);
    record = byId.get(record.replacedBy);
  }
  if (!record || record.retired || record.id === id) {
    return undefined;
  }
  // oxlint-disable-next-line eslint/one-var -- route is only known after the chain walk
  const route = currentRoute(record.keys);
  return route || undefined;
}

/** One row per concept that still has a route. Order follows the registry. */
export function toCatalog(records: readonly CatalogSource[]): Catalog {
  const byId = new Map(records.map((record) => [record.id, record])),
    concepts: CatalogConcept[] = [];
  for (const record of records) {
    const route = currentRoute(record.keys);
    if (!route) {
      continue;
    }
    // oxlint-disable-next-line eslint/one-var -- retired is per record, after the empty-route skip
    const retired = Boolean(record.retired),
      successor = retired ? successorRoute(byId, record.id) : undefined;
    concepts.push({
      id: record.id,
      label: record.label,
      retired,
      route,
      ...(successor ? { successor } : {}),
    });
  }
  return { concepts, version: 1 };
}

function visible(
  concepts: readonly CatalogConcept[],
  includeRetired: boolean
): CatalogConcept[] {
  if (includeRetired) {
    return [...concepts];
  }
  return concepts.filter((concept) => !concept.retired);
}

/** Case-insensitive substring match on the label and the route. */
export function searchConcepts(
  catalog: Catalog,
  query: string,
  limit: number,
  includeRetired: boolean
): CatalogConcept[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  // oxlint-disable-next-line eslint/one-var -- hits is the accumulator after the empty-query return
  const hits: CatalogConcept[] = [];
  for (const concept of visible(catalog.concepts, includeRetired)) {
    const haystack = `${concept.label}\n${concept.route}`.toLowerCase();
    if (!haystack.includes(needle)) {
      continue;
    }
    hits.push(concept);
    if (hits.length >= limit) {
      break;
    }
  }
  return hits;
}

function inArea(route: string, area: string): boolean {
  if (!area) {
    return true;
  }
  return route === area || route.startsWith(`${area}${AREA_SPLIT}`);
}

export function listConcepts(
  catalog: Catalog,
  query: ListQuery
): { items: CatalogConcept[]; total: number } {
  const matched = visible(catalog.concepts, query.includeRetired).filter(
      (concept) => inArea(concept.route, query.area)
    ),
    start = (query.page - 1) * query.limit;
  return {
    items: matched.slice(start, start + query.limit),
    total: matched.length,
  };
}

/** Match a concept id first, then an exact current route. */
export function findConcept(
  catalog: Catalog,
  spec: { id: string; route: string }
): CatalogConcept | undefined {
  if (spec.id) {
    return catalog.concepts.find((concept) => concept.id === spec.id);
  }
  if (spec.route) {
    return catalog.concepts.find((concept) => concept.route === spec.route);
  }
  return undefined;
}

/**
 * Keep only what a reader can open: a live concept whose page was not built
 * this time is dropped, and a successor link is kept only if that page exists.
 * Tombstones stay — `/id/{id}` answers for them whether or not a page does.
 */
export function withBuiltPages(
  catalog: Catalog,
  hasPage: (route: string) => boolean
): { catalog: Catalog; dropped: string[] } {
  const concepts: CatalogConcept[] = [],
    dropped: string[] = [];
  for (const concept of catalog.concepts) {
    if (!concept.retired && !hasPage(concept.route)) {
      dropped.push(concept.route);
      continue;
    }
    if (concept.successor && !hasPage(concept.successor)) {
      const { successor: _gone, ...rest } = concept;
      concepts.push(rest);
      continue;
    }
    concepts.push(concept);
  }
  return { catalog: { concepts, version: catalog.version }, dropped };
}
