/**
 * RFC 8288 Link headers: how an agent that fetched any page finds the API
 * catalog, the MCP server card and the sitemap.
 */
import { describe, expect, test } from "bun:test";

import worker from "./index";
import { withAgentLinks } from "./mcp";

type WorkerEnv = Parameters<typeof worker.fetch>[1];

const RELATIONS = [
    '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
    '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
    '</sitemap-index.xml>; rel="sitemap"; type="application/xml"',
  ],
  [API_CATALOG] = RELATIONS,
  html = (headers: Record<string, string> = {}) =>
    new Response("<html>page</html>", {
      headers: { "content-type": "text/html; charset=utf-8", ...headers },
    }),
  // oxlint-disable-next-line eslint/sort-vars -- assetsOnly closes over html (TDZ)
  assetsOnly = {
    ASSETS: { fetch: () => Promise.resolve(html()) },
  } as unknown as WorkerEnv;

describe("withAgentLinks", () => {
  test.each(RELATIONS)("an HTML page advertises %s", (relation) => {
    expect(withAgentLinks(html()).headers.get("link")).toContain(relation);
  });

  test("each relation appears once, even if the asset already sent it", () => {
    const link = withAgentLinks(
      html({ link: String(API_CATALOG) })
    ).headers.get("link");
    expect(link?.split('rel="api-catalog"')).toHaveLength(2);
  });

  test("an existing Link value is kept", () => {
    const link = withAgentLinks(
      html({ link: '</fonts/a.woff2>; rel="preload"' })
    ).headers.get("link");
    expect(link).toContain('rel="preload"');
  });

  test("non-HTML responses are left alone", () => {
    const json = Response.json({ ok: true });
    expect(withAgentLinks(json).headers.get("link")).toBeNull();
  });
});

describe("the home page", () => {
  test("reaches the Worker: wrangler routes / to it first", async () => {
    const config = await Bun.file(
      new URL("../wrangler.jsonc", import.meta.url)
    ).text();
    expect(config).toMatch(/"run_worker_first":\s*\[[^\]]*"\/"[,\]]/u);
  });

  test("carries the API catalog link", async () => {
    const response = await worker.fetch(
      new Request("https://digest.law/"),
      assetsOnly
    );
    expect(response.headers.get("link")).toContain('rel="api-catalog"');
  });
});
