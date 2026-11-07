/**
 * The public MCP endpoint: JSON-RPC, the catalog, and the per-IP rate limit.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import type { Catalog } from "../src/lib/mcp-catalog";
import worker from "./index";
import { handleMcp, MAX_BATCH, resetMcpCatalogCache } from "./mcp";
import type { McpEnv, RateLimit } from "./mcp";

const CATALOG: Catalog = {
    concepts: [
      {
        id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Proof of writings",
        retired: false,
        route: "evidence-law/proof-of-writings",
      },
      {
        id: "cccccccccccccccccccccccccccccccc",
        label: "Withdrawn",
        retired: true,
        route: "evidence-law/withdrawn-topic",
      },
    ],
    version: 1,
  },
  initialize = {
    id: 1,
    jsonrpc: "2.0",
    method: "initialize",
    params: {},
  };

function envWith(catalog: unknown, limiter?: RateLimit): McpEnv {
  return {
    ASSETS: {
      fetch: (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/mcp-catalog.json") {
          return Promise.resolve(Response.json(catalog));
        }
        return Promise.resolve(
          new Response("<html>page</html>", {
            headers: { "content-type": "text/html; charset=utf-8" },
            status: 200,
          })
        );
      },
    },
    MCP_RATE_LIMITER: limiter,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://digest.law/mcp", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });
}

function toolText(body: { result: { content: { text: string }[] } }): string {
  const [first] = body.result.content;
  if (!first) {
    return "{}";
  }
  return first.text;
}

beforeEach(() => {
  resetMcpCatalogCache();
});

describe("MCP JSON-RPC", () => {
  test("GET explains the endpoint", async () => {
    const response = await handleMcp(
      new Request("https://digest.law/mcp"),
      envWith(CATALOG)
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
  });

  test("POST initialize names the server", async () => {
    const response = await handleMcp(post(initialize), envWith(CATALOG)),
      // oxlint-disable-next-line eslint/sort-vars -- body is read from response
      body = (await response.json()) as {
        result: { protocolVersion: string; serverInfo: { name: string } };
      };
    expect(body.result.serverInfo.name).toBe("digest-law");
    expect(body.result.protocolVersion).toBe("2025-06-18");
  });

  test("tools/list advertises the catalog tools", async () => {
    const response = await handleMcp(
        post({ id: 2, jsonrpc: "2.0", method: "tools/list" }),
        envWith(CATALOG)
      ),
      // oxlint-disable-next-line eslint/sort-vars -- body is read from response
      body = (await response.json()) as {
        result: { tools: { name: string }[] };
      };
    expect(body.result.tools.map((tool) => tool.name).toSorted()).toEqual([
      "get_concept",
      "list_concepts",
      "search_concepts",
    ]);
  });

  test("search_concepts returns the page and the permanent IRI", async () => {
    const response = await handleMcp(
        post({
          id: 3,
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            arguments: { query: "proof" },
            name: "search_concepts",
          },
        }),
        envWith(CATALOG)
      ),
      // oxlint-disable-next-line eslint/sort-vars -- body is read from response
      body = (await response.json()) as {
        result: { content: { text: string }[] };
      },
      // oxlint-disable-next-line eslint/sort-vars -- data is parsed from body
      data = JSON.parse(toolText(body)) as {
        items: { iri: string; url: string }[];
      };
    expect(data.items[0]?.url).toBe(
      "https://digest.law/evidence-law/proof-of-writings/"
    );
    expect(data.items[0]?.iri).toBe(
      "https://w3id.org/digest-law/concept/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  });

  test("a missing concept is a tool error, not an HTTP error", async () => {
    const response = await handleMcp(
        post({
          id: 4,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { id: "missing" }, name: "get_concept" },
        }),
        envWith(CATALOG)
      ),
      // oxlint-disable-next-line eslint/sort-vars -- body is read from response
      body = (await response.json()) as { result: { isError: boolean } };
    expect(response.status).toBe(200);
    expect(body.result.isError).toBe(true);
  });

  test("a notification gets 202 and no body", async () => {
    const response = await handleMcp(
      post({ jsonrpc: "2.0", method: "notifications/initialized" }),
      envWith(CATALOG)
    );
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
  });

  test("broken JSON is a parse error", async () => {
    const response = await handleMcp(
      new Request("https://digest.law/mcp", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      envWith(CATALOG)
    );
    expect(response.status).toBe(400);
  });
});

describe("malformed messages and batches", () => {
  const ping = { id: 7, jsonrpc: "2.0", method: "ping" };

  test.each([
    ["null", null],
    ["a number", 5],
    ["a string", "ping"],
    ["a message with no method", { id: 1, jsonrpc: "2.0" }],
    ["a non-string method", { id: 1, jsonrpc: "2.0", method: 5 }],
  ])("%s is an Invalid Request, not a crash", async (_label, body) => {
    const response = await handleMcp(post(body), envWith(CATALOG)),
      // oxlint-disable-next-line eslint/sort-vars -- reply is read from response
      reply = (await response.json()) as { error: { code: number } };
    expect(response.status).toBe(400);
    expect(reply.error.code).toBe(-32_600);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test.each([
    ["null", null],
    ["an array", []],
    ["a message with no method", { id: 1, jsonrpc: "2.0" }],
  ])(
    "a bad item (%s) in a batch does not sink the others",
    async (_label, item) => {
      const response = await handleMcp(post([item, ping]), envWith(CATALOG)),
        // oxlint-disable-next-line eslint/sort-vars -- replies are read from response
        replies = (await response.json()) as {
          error?: { code: number };
          id: unknown;
          result?: unknown;
        }[];
      // oxlint-disable-next-line eslint/one-var -- destructures replies, read above
      const [bad, good] = replies;
      expect(response.status).toBe(200);
      expect(bad?.error?.code).toBe(-32_600);
      expect(good?.id).toBe(7);
    }
  );

  test.each([
    ["empty", 0],
    ["over the cap", MAX_BATCH + 1],
  ])("a batch that is %s is refused whole", async (_label, size) => {
    const response = await handleMcp(
        post(Array.from({ length: size }, () => ping)),
        envWith(CATALOG)
      ),
      // oxlint-disable-next-line eslint/sort-vars -- reply is read from response
      reply = (await response.json()) as { error: { code: number } };
    expect(response.status).toBe(400);
    expect(reply.error.code).toBe(-32_600);
  });

  test("an oversized batch is refused before the catalog is fetched", async () => {
    let fetched = false;
    const env: McpEnv = {
        ASSETS: {
          fetch: () => {
            fetched = true;
            return Promise.resolve(Response.json(CATALOG));
          },
        },
      },
      response = await handleMcp(
        post(Array.from({ length: MAX_BATCH + 1 }, () => ping)),
        env
      );
    expect(response.status).toBe(400);
    expect(fetched).toBe(false);
  });

  test("a batch at the cap is answered", async () => {
    const response = await handleMcp(
        post(Array.from({ length: MAX_BATCH }, () => ping)),
        envWith(CATALOG)
      ),
      // oxlint-disable-next-line eslint/sort-vars -- replies are read from response
      replies = (await response.json()) as unknown[];
    expect(response.status).toBe(200);
    expect(replies).toHaveLength(MAX_BATCH);
  });
});

describe("the rate limit", () => {
  test("a refused key is 429 and the catalog is not required", async () => {
    let fetched = false;
    const env: McpEnv = {
        ASSETS: {
          fetch: () => {
            fetched = true;
            return Promise.resolve(Response.json(CATALOG));
          },
        },
        MCP_RATE_LIMITER: {
          limit: () => Promise.resolve({ success: false }),
        },
      },
      response = await handleMcp(
        post(initialize, { "cf-connecting-ip": "203.0.113.8" }),
        env
      ),
      // oxlint-disable-next-line eslint/sort-vars -- body is read from response
      body = (await response.json()) as { error: { code: number } };
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("10");
    expect(body.error.code).toBe(-32_029);
    expect(fetched).toBe(false);
  });

  test("the key is the client IP", async () => {
    const keys: string[] = [],
      limiter: RateLimit = {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: true });
        },
      };
    await handleMcp(
      post(initialize, { "cf-connecting-ip": "203.0.113.9" }),
      envWith(CATALOG, limiter)
    );
    expect(keys).toEqual(["203.0.113.9"]);
  });

  test("without the binding the endpoint still answers", async () => {
    const response = await handleMcp(post(initialize), envWith(CATALOG));
    expect(response.status).toBe(200);
  });

  test("wrangler caps MCP at 60 requests per 60 seconds", async () => {
    const config = await Bun.file(
      new URL("../wrangler.jsonc", import.meta.url)
    ).text();
    expect(config).toContain('"name": "MCP_RATE_LIMITER"');
    expect(config).toContain('"namespace_id": "2101"');
    expect(config).toMatch(/"limit":\s*60/u);
    expect(config).toMatch(/"period":\s*60/u);
    expect(config).toContain('"/mcp"');
  });
});

describe("discovery", () => {
  test("an HTML page carries the server-card link", async () => {
    const response = await worker.fetch(
      new Request("https://digest.law/evidence-law/"),
      envWith(CATALOG) as unknown as Parameters<typeof worker.fetch>[1]
    );
    expect(response.headers.get("link")).toContain(
      '</.well-known/mcp/server-card.json>; rel="service-desc"'
    );
    expect(await response.text()).toContain("page");
  });

  test("/mcp reaches the handler through the worker", async () => {
    const response = await worker.fetch(
      post(initialize),
      envWith(CATALOG) as unknown as Parameters<typeof worker.fetch>[1]
    );
    expect(response.status).toBe(200);
  });
});
