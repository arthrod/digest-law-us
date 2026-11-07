/**
 * The published server card must describe the server that actually runs.
 */
import { describe, expect, test } from "bun:test";

import { handleMcp } from "./mcp";

interface Card {
  serverInfo: { name: string; version: string };
  tools: { name: string }[];
  transport: { endpoint: string; type: string };
}

const card = (await Bun.file(
  new URL("../public/.well-known/mcp/server-card.json", import.meta.url)
).json()) as Card;

async function live(method: string): Promise<Record<string, unknown>> {
  const response = await handleMcp(
    new Request("https://digest.law/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: {} }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    {
      ASSETS: {
        fetch: () => Promise.resolve(new Response("{}", { status: 404 })),
      },
    }
  );
  return ((await response.json()) as { result: Record<string, unknown> })
    .result;
}

describe("server card", () => {
  test("lists exactly the tools tools/list returns", async () => {
    const { tools } = (await live("tools/list")) as {
      tools: { name: string }[];
    };
    expect(card.tools.map((tool) => tool.name).toSorted()).toEqual(
      tools.map((tool) => tool.name).toSorted()
    );
  });

  test("names the server initialize reports", async () => {
    const { serverInfo } = (await live("initialize")) as {
      serverInfo: { name: string; version: string };
    };
    expect(card.serverInfo.name).toBe(serverInfo.name);
    expect(card.serverInfo.version).toBe(serverInfo.version);
  });

  test("points at the production endpoint over streamable HTTP", () => {
    expect(card.transport).toEqual({
      endpoint: "https://digest.law/mcp",
      type: "streamable-http",
    });
  });
});
