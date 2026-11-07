/**
 * public/webmcp.js, the WebMCP registration every page loads: run as the
 * browser would, against a fake modelContext and a fetch wired to the real
 * /mcp handler. The fake follows Chrome's: it lives on document (navigator
 * is the alias Chrome 150 deprecated), and registerTool returns a promise
 * that rejects a name registered twice.
 */
import { beforeEach, describe, expect, test } from "bun:test";

import type { Catalog } from "../src/lib/mcp-catalog";
import { handleMcp, resetMcpCatalogCache } from "./mcp";
import type { McpEnv } from "./mcp";

interface WebMcpTool {
  annotations?: { readOnlyHint?: boolean };
  description: string;
  execute: (
    input: unknown,
    options?: { signal?: AbortSignal }
  ) => Promise<unknown>;
  inputSchema: unknown;
  name: string;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const CATALOG: Catalog = {
    concepts: [
      {
        id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Proof of writings",
        retired: false,
        route: "evidence-law/proof-of-writings",
      },
    ],
    version: 1,
  },
  ENV: McpEnv = {
    ASSETS: {
      fetch: () => Promise.resolve(Response.json(CATALOG)),
    },
  },
  SOURCE = await Bun.file(
    new URL("../public/webmcp.js", import.meta.url)
  ).text(),
  requests: Request[] = [],
  toMcp: Fetch = async (url, init) => {
    const request = new Request(new URL(url, "https://digest.law"), init);
    requests.push(request.clone());
    return await handleMcp(request, ENV);
  };

/** Runs the script once, as a page load would. */
function load(
  globals: { document?: object; navigator?: object },
  fetch: Fetch = toMcp
): void {
  // oxlint-disable-next-line typescript/no-implied-eval, no-new-func -- runs the shipped file as a browser would
  new Function("document", "navigator", "fetch", SOURCE)(
    globals.document ?? {},
    globals.navigator ?? {},
    fetch
  );
}

/** A modelContext whose registerTool rejects a name twice, as Chrome's does. */
function modelContext() {
  const tools: WebMcpTool[] = [];
  return {
    registerTool: (tool: WebMcpTool): Promise<void> => {
      if (tools.some((known) => known.name === tool.name)) {
        return Promise.reject(
          new Error(`InvalidStateError: ${tool.name} is registered`)
        );
      }
      tools.push(tool);
      return Promise.resolve();
    },
    tools,
  };
}

/** The page's own context: document.modelContext. */
function onDocument(context: object) {
  return { document: { modelContext: context } };
}

async function serverTools(): Promise<
  { description: string; inputSchema: unknown; name: string }[]
> {
  const response = await handleMcp(
      new Request("https://digest.law/mcp", {
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      ENV
    ),
    // oxlint-disable-next-line eslint/sort-vars -- reply is read from response
    reply = (await response.json()) as {
      result: {
        tools: { description: string; inputSchema: unknown; name: string }[];
      };
    };
  return reply.result.tools;
}

function named(tools: WebMcpTool[], name: string): WebMcpTool {
  const found = tools.find((tool) => tool.name === name);
  expect(found).toBeDefined();
  return found as WebMcpTool;
}

beforeEach(() => {
  resetMcpCatalogCache();
  requests.length = 0;
});

describe("public/webmcp.js", () => {
  test("without WebMCP it does nothing and sends nothing", () => {
    expect(() => {
      load({}, () => Promise.reject(new Error("no request expected")));
      load({ document: {}, navigator: {} });
    }).not.toThrow();
    expect(requests).toHaveLength(0);
  });

  test("registers every /mcp tool with the server's description and schema", async () => {
    const context = modelContext();
    load(onDocument(context));
    expect(
      context.tools.map(({ description, inputSchema, name }) => ({
        description,
        inputSchema,
        name,
      }))
    ).toEqual(await serverTools());
  });

  test("marks every tool read-only", () => {
    const context = modelContext();
    load(onDocument(context));
    expect(context.tools.map((tool) => tool.annotations?.readOnlyHint)).toEqual(
      [true, true, true]
    );
  });

  test("a tool call is a tools/call to POST /mcp and returns its result", async () => {
    const context = modelContext();
    load(onDocument(context));
    // oxlint-disable-next-line eslint/one-var -- the tool exists only once the script has run
    const result = (await named(context.tools, "search_concepts").execute({
        query: "writings",
      })) as { content: { text: string }[]; isError?: boolean },
      [request] = requests;
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("evidence-law/proof-of-writings");
    expect(request?.method).toBe("POST");
    expect(new URL(String(request?.url)).pathname).toBe("/mcp");
    expect(request?.headers.get("accept")).toContain("application/json");
    expect(await request?.json()).toEqual({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { query: "writings" }, name: "search_concepts" },
    });
  });

  test("a JSON-RPC error comes back as an error result", async () => {
    const context = modelContext();
    load(onDocument(context), () =>
      Promise.resolve(
        Response.json(
          {
            error: { code: -32_029, message: "Too many requests." },
            id: 1,
            jsonrpc: "2.0",
          },
          { status: 429 }
        )
      )
    );
    expect(
      await named(context.tools, "get_concept").execute({ id: "x" })
    ).toEqual({
      content: [{ text: "Too many requests.", type: "text" }],
      isError: true,
    });
  });

  test("a network failure comes back as an error result", async () => {
    const context = modelContext();
    load(onDocument(context), () => Promise.reject(new Error("offline")));
    // oxlint-disable-next-line eslint/one-var -- the tool exists only once the script has run
    const result = (await named(context.tools, "list_concepts").execute(
      {}
    )) as { content: { text: string }[]; isError: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("offline");
  });

  test("a second page load in the same visit leaves no unhandled rejection", async () => {
    const context = modelContext(),
      rejections: unknown[] = [],
      track = (reason: unknown) => {
        rejections.push(reason);
      };
    process.on("unhandledRejection", track);
    load(onDocument(context));
    load(onDocument(context));
    await Bun.sleep(10);
    process.off("unhandledRejection", track);
    expect(rejections).toEqual([]);
    expect(context.tools).toHaveLength(3);
  });

  test("registers on document.modelContext, where Chrome 150+ looks", () => {
    const context = modelContext();
    load(onDocument(context));
    expect(context.tools.map((tool) => tool.name)).toEqual([
      "search_concepts",
      "list_concepts",
      "get_concept",
    ]);
  });

  test("with both, registers once, on document", () => {
    const deprecated = modelContext(),
      page = modelContext();
    load({
      document: { modelContext: page },
      navigator: { modelContext: deprecated },
    });
    expect(page.tools).toHaveLength(3);
    expect(deprecated.tools).toHaveLength(0);
  });

  test("falls back to navigator.modelContext, as before Chrome 150", () => {
    const context = modelContext();
    load({ navigator: { modelContext: context } });
    expect(context.tools).toHaveLength(3);
  });

  test("arguments sent as a JSON string (before Chrome 155) are parsed", async () => {
    const context = modelContext();
    load(onDocument(context));
    await named(context.tools, "search_concepts").execute(
      '{"query":"writings"}'
    );
    expect(await requests[0]?.json()).toMatchObject({
      params: { arguments: { query: "writings" }, name: "search_concepts" },
    });
  });

  test("the agent's signal cancels the request to /mcp", async () => {
    const context = modelContext(),
      controller = new AbortController(),
      signals: (AbortSignal | null | undefined)[] = [];
    load(onDocument(context), async (url, init) => {
      signals.push(init?.signal);
      return await toMcp(url, init);
    });
    await named(context.tools, "list_concepts").execute(
      {},
      { signal: controller.signal }
    );
    expect(signals).toEqual([controller.signal]);
  });

  test("falls back to provideContext where registerTool is missing", () => {
    const provided: { tools: WebMcpTool[] }[] = [];
    load(
      onDocument({
        provideContext: (init: { tools: WebMcpTool[] }) => {
          provided.push(init);
        },
      })
    );
    expect(provided[0]?.tools.map((tool) => tool.name)).toEqual([
      "search_concepts",
      "list_concepts",
      "get_concept",
    ]);
  });
});
