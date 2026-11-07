/**
 * Public MCP server for the American Legal Digest.
 *
 * Stateless Streamable HTTP: POST a JSON-RPC message, get a JSON response.
 * Read-only. The concept catalog is the static `/mcp-catalog.json` asset.
 * Rate-limited per client IP via the Workers rate-limit binding, same cap as
 * Live Contracts (60 requests / 60 seconds). The binding is optional so a
 * local `wrangler dev` without it still answers.
 */

import {
  findConcept,
  listConcepts,
  searchConcepts,
} from "../src/lib/mcp-catalog";
import type { Catalog, CatalogConcept } from "../src/lib/mcp-catalog";

const CONCEPT_IRI = "https://w3id.org/digest-law/concept/",
  CORS = {
    "Access-Control-Allow-Headers":
      "content-type, mcp-session-id, mcp-protocol-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Max-Age": "86400",
  },
  /**
   * RFC 8288 relations sent on every HTML response, same set as
   * live-contracts: the RFC 9727 API catalog, the MCP server card, and the
   * sitemap. The catalog body is a static asset (public/.well-known/).
   */
  DISCOVERY_LINKS = [
    {
      rel: "api-catalog",
      value:
        '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
    },
    {
      rel: "service-desc",
      value:
        '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
    },
    {
      rel: "sitemap",
      value: '</sitemap-index.xml>; rel="sitemap"; type="application/xml"',
    },
  ],
  INSTRUCTIONS =
    "Read-only access to the American Legal Digest concept catalog. " +
    "Use search_concepts to match a label or route, list_concepts to browse an area, " +
    "and get_concept to resolve one id or route to its page and permanent IRI. " +
    "The digest prose is on the page at url — this catalog is labels and routes, not the full text. " +
    "Digests are a map of doctrine pointing at authorities, not legal advice.",
  PROTOCOL_VERSION = "2025-06-18",
  SERVER_INFO = {
    name: "digest-law",
    title: "American Legal Digest",
    version: "1.0.0",
  },
  SITE = "https://digest.law",
  TOOLS = [
    {
      description:
        "Search the concept catalog by label or route (substring, case-insensitive). Returns matching concepts with their pages. Does not search the full text of a digest.",
      inputSchema: {
        properties: {
          include_retired: {
            default: false,
            description: "Include tombstoned concepts. Off by default.",
            type: "boolean",
          },
          limit: { default: 20, maximum: 50, minimum: 1, type: "integer" },
          query: {
            description: "Words from a concept label or route.",
            type: "string",
          },
        },
        required: ["query"],
        type: "object",
      },
      name: "search_concepts",
    },
    {
      description:
        "List concepts in catalog order, optionally limited to one area (the first path segment, or a longer route prefix).",
      inputSchema: {
        properties: {
          area: {
            description: "Route prefix, e.g. evidence-law.",
            type: "string",
          },
          include_retired: { default: false, type: "boolean" },
          limit: { default: 20, maximum: 50, minimum: 1, type: "integer" },
          page: { default: 1, minimum: 1, type: "integer" },
        },
        type: "object",
      },
      name: "list_concepts",
    },
    {
      description:
        "Fetch one concept by its 32-character id or its current route. Returns the page URL and the permanent concept IRI.",
      inputSchema: {
        properties: {
          id: { description: "32 lowercase hex concept id.", type: "string" },
          route: {
            description: "Current route, e.g. evidence-law/proof-of-writings.",
            type: "string",
          },
        },
        type: "object",
      },
      name: "get_concept",
    },
  ];

/** Most messages one POST may carry; one POST spends one rate-limit token. */
// oxlint-disable-next-line eslint/one-var -- exported, so it cannot join the private list above
export const MAX_BATCH = 10;

export interface RateLimit {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

export interface McpEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  MCP_RATE_LIMITER?: RateLimit;
}

type Json = Record<string, unknown>;

// oxlint-disable-next-line eslint/one-var -- err follows the exported interfaces and the Json type
const err = (id: unknown, code: number, message: string): Json => ({
    error: { code, message },
    id: id ?? null,
    jsonrpc: "2.0",
  }),
  ok = (id: unknown, result: Json): Json => ({
    id: id ?? null,
    jsonrpc: "2.0",
    result,
  });

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function textArg(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function flag(value: unknown): boolean {
  return value === true;
}

let catalogPromise: Promise<Catalog | null> | null = null;

/** Test seam. The catalog is cached for the life of the isolate. */
export function resetMcpCatalogCache(): void {
  catalogPromise = null;
}

function isCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== "object") {
    return false;
  }
  const catalog = value as Catalog;
  return catalog.version === 1 && Array.isArray(catalog.concepts);
}

async function fetchCatalog(
  request: Request,
  env: McpEnv
): Promise<Catalog | null> {
  try {
    const response = await env.ASSETS.fetch(
      new Request(new URL("/mcp-catalog.json", request.url), { method: "GET" })
    );
    if (!response.ok) {
      return null;
    }
    // oxlint-disable-next-line eslint/one-var -- parsed only after response.ok
    const body: unknown = await response.json();
    return isCatalog(body) ? body : null;
  } catch {
    return null;
  }
}

async function loadCatalog(
  request: Request,
  env: McpEnv
): Promise<Catalog | null> {
  catalogPromise ??= fetchCatalog(request, env);
  const catalog = await catalogPromise;
  if (!catalog) {
    catalogPromise = null;
  }
  return catalog;
}

function present(concept: CatalogConcept): Json {
  return {
    id: concept.id,
    iri: `${CONCEPT_IRI}${concept.id}`,
    label: concept.label,
    retired: concept.retired,
    route: concept.route,
    url: `${SITE}/${concept.route}/`,
    ...(concept.successor
      ? {
          successor: concept.successor,
          successor_url: `${SITE}/${concept.successor}/`,
        }
      : {}),
  };
}

function callTool(catalog: Catalog, name: string, args: Json): Json | null {
  if (name === "search_concepts") {
    const query = textArg(args.query);
    if (!query) {
      throw new Error("query is required");
    }
    // oxlint-disable-next-line eslint/one-var -- search runs only after query is validated
    const items = searchConcepts(
      catalog,
      query,
      clampInt(args.limit, 1, 50, 20),
      flag(args.include_retired)
    );
    return { count: items.length, items: items.map(present) };
  }
  if (name === "list_concepts") {
    const page = listConcepts(catalog, {
      area: textArg(args.area),
      includeRetired: flag(args.include_retired),
      limit: clampInt(args.limit, 1, 50, 20),
      page: clampInt(args.page, 1, 100_000, 1),
    });
    return {
      count: page.items.length,
      items: page.items.map(present),
      page: clampInt(args.page, 1, 100_000, 1),
      total: page.total,
    };
  }
  if (name === "get_concept") {
    const concept = findConcept(catalog, {
      id: textArg(args.id).toLowerCase(),
      route: textArg(args.route).replaceAll(/^\/|\/$/gu, ""),
    });
    return concept ? present(concept) : null;
  }
  throw new Error(`unknown tool: ${name}`);
}

function handleMessage(message: unknown, catalog: Catalog | null): Json | null {
  // request.json() accepts any JSON: null, 5, "ping" and {"method": 5} all
  // parse. They must come back as Invalid Request, not as a thrown TypeError.
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return err(null, -32_600, "Invalid Request");
  }
  // oxlint-disable-next-line eslint/one-var -- destructured only once message is known to be an object
  const { id, method, params } = message as {
    id?: unknown;
    method?: unknown;
    params?: Json;
  };
  if (typeof method !== "string" || !method) {
    return err(id, -32_600, "Invalid Request");
  }
  if (method === "initialize") {
    return ok(id, {
      capabilities: { tools: { listChanged: false } },
      instructions: INSTRUCTIONS,
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
    });
  }
  if (method.startsWith("notifications/")) {
    return null;
  }
  if (method === "ping") {
    return ok(id, {});
  }
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }
  if (method === "tools/call") {
    if (!catalog) {
      return ok(id, {
        content: [{ text: "Concept catalog is unavailable.", type: "text" }],
        isError: true,
      });
    }
    const args = ((params as Json | undefined)?.arguments as Json) ?? {},
      name = textArg((params as Json | undefined)?.name);
    try {
      const data = callTool(catalog, name, args);
      if (data === null) {
        return ok(id, {
          content: [
            { text: "No concept found for that id or route.", type: "text" },
          ],
          isError: true,
        });
      }
      return ok(id, {
        content: [{ text: JSON.stringify(data, null, 2), type: "text" }],
      });
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : String(error);
      return ok(id, {
        content: [{ text: `Error: ${messageText}`, type: "text" }],
        isError: true,
      });
    }
  }
  return err(id, -32_601, `Method not found: ${method}`);
}

function isInvalidRequest(reply: Json): boolean {
  return (reply.error as { code?: number } | undefined)?.code === -32_600;
}

function json(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return Response.json(body, {
    headers: { ...CORS, ...extra },
    status,
  });
}

/**
 * Discovery relations on HTML documents, so an agent that fetched any page
 * can find the API catalog, the server card and the sitemap. A relation the
 * response already carries (from `_headers`, say) is not repeated.
 */
export function withAgentLinks(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "",
    headers = new Headers(response.headers);
  if (!contentType.includes("text/html")) {
    return response;
  }
  // oxlint-disable-next-line eslint/one-var -- read only for HTML responses
  const existing = headers.get("link") ?? "";
  for (const { rel, value } of DISCOVERY_LINKS) {
    if (!existing.includes(`rel="${rel}"`)) {
      headers.append("Link", value);
    }
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function limited(
  request: Request,
  env: McpEnv
): Promise<Response | null> {
  const key = request.headers.get("cf-connecting-ip") ?? "anon",
    limiter = env.MCP_RATE_LIMITER;
  if (!limiter) {
    return null;
  }
  // oxlint-disable-next-line eslint/one-var -- success depends on the await below the guard
  const { success } = await limiter.limit({ key });
  if (success) {
    return null;
  }
  return json(
    err(null, -32_029, "Rate limit exceeded — slow down and retry shortly."),
    429,
    { "retry-after": "10" }
  );
}

export async function handleMcp(
  request: Request,
  env: McpEnv
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS, status: 204 });
  }
  if (request.method === "GET") {
    return new Response(
      "American Legal Digest MCP server. POST JSON-RPC (MCP Streamable HTTP) to this endpoint.",
      { headers: { Allow: "POST, OPTIONS", ...CORS }, status: 405 }
    );
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      headers: { Allow: "POST, OPTIONS", ...CORS },
      status: 405,
    });
  }

  const blocked = await limited(request, env);
  if (blocked) {
    return blocked;
  }

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return json(err(null, -32_700, "Parse error"), 400);
  }

  // oxlint-disable-next-line eslint/one-var -- catalog loads only after the rate limit and the parse
  // One POST spends one rate-limit token, so a batch is capped: without a
  // cap, one request could run thousands of catalog scans.
  if (
    Array.isArray(message) &&
    (message.length === 0 || message.length > MAX_BATCH)
  ) {
    return json(
      err(null, -32_600, `A batch holds 1 to ${MAX_BATCH} messages.`),
      400
    );
  }
  // oxlint-disable-next-line eslint/one-var -- catalog loads only after the batch check
  const catalog = await loadCatalog(request, env);
  if (Array.isArray(message)) {
    const replies = message
      .map((item) => handleMessage(item, catalog))
      .filter((reply): reply is Json => reply !== null);
    return replies.length
      ? json(replies)
      : new Response(null, { headers: CORS, status: 202 });
  }
  // oxlint-disable-next-line eslint/one-var -- reply is only needed on the single-message path
  const reply = handleMessage(message, catalog);
  if (reply === null) {
    return new Response(null, { headers: CORS, status: 202 });
  }
  return json(reply, isInvalidRequest(reply) ? 400 : 200);
}
