/**
 * Markdown for agents: `Accept: text/markdown` gets the page converted by
 * Workers AI; everything else gets the HTML, unchanged but for `Vary: Accept`.
 */
import { describe, expect, test } from "bun:test";

import { CONTENT_SIGNAL } from "../src/lib/robots";
import worker from "./index";
import {
  MAX_HTML_BYTES,
  negotiateMarkdown,
  prefersMarkdown,
  varyOnAccept,
} from "./markdown";
import type {
  MarkdownAi,
  MarkdownCache,
  MarkdownConversion,
  MarkdownEnv,
} from "./markdown";

type WorkerEnv = Parameters<typeof worker.fetch>[1];

interface AiCall {
  hostname?: string;
  html: string;
  name: string;
}

const BROWSER =
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
  CONVERTED: MarkdownConversion = {
    data: "# Proof of writings\n\nProof\n",
    format: "markdown",
    name: "index.html",
    tokens: 7,
  },
  ETAG = '"abc123"',
  MARKDOWN_ETAG = 'W/"md-abc123"',
  PAGE = "https://digest.law/evidence-law/proof-of-writings/",
  PAGE_HTML =
    "<html><head><title>Proof of writings</title></head><body><main>Proof</main></body></html>";

function htmlResponse(
  body: BodyInit = PAGE_HTML,
  headers: Record<string, string> = {},
  status = 200
): Response {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "content-type": "text/html; charset=utf-8",
      etag: ETAG,
      ...headers,
    },
    status,
  });
}

/** A renderer standing in for the assets/shard dispatch; records requests. */
function renderer(make: () => Response = () => htmlResponse()) {
  const seen: Request[] = [];
  return {
    render: (request: Request) => {
      seen.push(request);
      return Promise.resolve(make());
    },
    seen,
  };
}

function fakeAi(
  result: () => Promise<MarkdownConversion | MarkdownConversion[]> = () =>
    Promise.resolve(CONVERTED)
) {
  const calls: AiCall[] = [];
  return {
    ai: {
      toMarkdown: async (document, options) => {
        calls.push({
          hostname: options?.conversionOptions?.html?.hostname,
          html: await document.blob.text(),
          name: document.name,
        });
        return await result();
      },
    } satisfies MarkdownAi,
    calls,
  };
}

function fakeCache() {
  const store = new Map<string, Response>();
  return {
    cache: {
      match: (key) => Promise.resolve(store.get(key.url)?.clone()),
      put: (key, response) => {
        store.set(key.url, response);
        return Promise.resolve();
      },
    } satisfies MarkdownCache,
    store,
  };
}

/** A page body that records whether it was cancelled rather than sent. */
function trackedBody() {
  const audit = { cancelled: false },
    body = new ReadableStream<Uint8Array>({
      cancel: () => {
        audit.cancelled = true;
      },
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode(PAGE_HTML));
        controller.close();
      },
    });
  return { body, state: audit };
}

function head(headers: Record<string, string> = {}): Request {
  return new Request(PAGE, {
    headers: { accept: "text/markdown", ...headers },
    method: "HEAD",
  });
}

async function wranglerConfig(): Promise<string> {
  return await Bun.file(new URL("../wrangler.jsonc", import.meta.url)).text();
}

function get(accept: string | null, headers: Record<string, string> = {}) {
  return new Request(PAGE, {
    headers: accept === null ? headers : { accept, ...headers },
  });
}

describe("prefersMarkdown", () => {
  test.each([
    ["text/markdown", true],
    ["Text/Markdown", true],
    ["text/x-markdown", true],
    ["text/markdown, text/html;q=0.9", true],
    ["text/html;q=0.5, text/markdown", true],
    ["text/markdown, text/html", true],
    ["text/html, text/markdown;q=0.5", false],
    ["text/markdown;q=0", false],
    ["*/*", false],
    ["text/*", false],
    ["", false],
    [BROWSER, false],
  ])("Accept %p → %p", (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected);
  });

  test("no Accept header → HTML", () => {
    expect(prefersMarkdown(null)).toBe(false);
  });
});

describe("negotiateMarkdown", () => {
  test("converts the page and answers text/markdown", async () => {
    const { ai } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(await response.text()).toBe(String(CONVERTED.data));
  });

  test("says how many tokens, what it varies on, and the content signal", async () => {
    const { ai } = fakeAi(),
      { render } = renderer(),
      { headers } = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(headers.get("x-markdown-tokens")).toBe("7");
    expect(headers.get("vary")).toContain("Accept");
    expect(headers.get("content-signal")).toBe(CONTENT_SIGNAL);
  });

  test("hands the converter the page HTML and its URL for relative links", async () => {
    const { ai, calls } = fakeAi(),
      { render } = renderer();
    await negotiateMarkdown(get("text/markdown"), { AI: ai }, render);
    expect(calls).toEqual([
      { hostname: PAGE, html: PAGE_HTML, name: "index.html" },
    ]);
  });

  test("asks the renderer for the full page, not a 304", async () => {
    const { ai } = fakeAi(),
      { render, seen } = renderer();
    await negotiateMarkdown(
      get("text/markdown", {
        "if-modified-since": "Sat, 07 Nov 2026 00:00:00 GMT",
        "if-none-match": ETAG,
      }),
      { AI: ai },
      render
    );
    expect(seen[0]?.method).toBe("GET");
    expect(seen[0]?.headers.get("if-none-match")).toBeNull();
    expect(seen[0]?.headers.get("if-modified-since")).toBeNull();
  });

  test("keeps the page's Link header", async () => {
    const { ai } = fakeAi(),
      { render } = renderer(() =>
        htmlResponse(PAGE_HTML, { link: '</x>; rel="api-catalog"' })
      ),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(response.headers.get("link")).toBe('</x>; rel="api-catalog"');
  });

  test("accepts the array form of the converter's answer", async () => {
    const { ai } = fakeAi(() => Promise.resolve([CONVERTED])),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(await response.text()).toBe(String(CONVERTED.data));
  });

  test("HEAD gets the markdown headers and no body", async () => {
    const { ai } = fakeAi(),
      { render, seen } = renderer(),
      response = await negotiateMarkdown(
        new Request(PAGE, {
          headers: { accept: "text/markdown" },
          method: "HEAD",
        }),
        { AI: ai },
        render
      );
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(await response.text()).toBe("");
    expect(seen[0]?.method).toBe("GET");
  });
});

describe("falls back to the HTML", () => {
  test.each([
    ["without the AI binding", {} as MarkdownEnv, () => htmlResponse()],
    [
      "when the converter throws",
      {
        AI: fakeAi(() => Promise.reject(new Error("AI down"))).ai,
      } as MarkdownEnv,
      () => htmlResponse(),
    ],
    [
      "when the converter reports an error",
      {
        AI: fakeAi(() =>
          Promise.resolve({ error: "bad", format: "error" as const })
        ).ai,
      } as MarkdownEnv,
      () => htmlResponse(),
    ],
    [
      "when the converter returns nothing",
      {
        AI: fakeAi(() =>
          Promise.resolve({ data: "", format: "markdown" as const })
        ).ai,
      } as MarkdownEnv,
      () => htmlResponse(),
    ],
  ])("%s", async (_label, env, make) => {
    const { render } = renderer(make),
      response = await negotiateMarkdown(get("text/markdown"), env, render);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8"
    );
    expect(response.headers.get("vary")).toContain("Accept");
    expect(await response.text()).toBe(PAGE_HTML);
  });

  test("a page over the size cap is not sent to the converter", async () => {
    const { ai, calls } = fakeAi(),
      { render } = renderer(() =>
        htmlResponse(PAGE_HTML, {
          "content-length": String(MAX_HTML_BYTES + 1),
        })
      ),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(calls).toHaveLength(0);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  test("a page over the size cap without Content-Length is measured", async () => {
    const big = `<html>${"x".repeat(MAX_HTML_BYTES)}</html>`,
      { ai, calls } = fakeAi(),
      { render } = renderer(
        () =>
          new Response(new Blob([big]).stream(), {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
      ),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    // oxlint-disable-next-line eslint/one-var -- read after the request above settles
    const body = await response.text();
    expect(calls).toHaveLength(0);
    expect(body).toHaveLength(big.length);
  });

  test.each([
    ["a 404 page", () => htmlResponse("<html>404</html>", {}, 404)],
    [
      "a redirect",
      () =>
        new Response(null, {
          headers: { location: `${PAGE}x/` },
          status: 308,
        }),
    ],
    ["a JSON file", () => Response.json({ ok: true })],
  ])("%s passes through unconverted", async (_label, make) => {
    const { ai, calls } = fakeAi(),
      { render } = renderer(make),
      expected = make(),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(calls).toHaveLength(0);
    expect(response.status).toBe(expected.status);
    expect(response.headers.get("content-type")).toBe(
      expected.headers.get("content-type")
    );
  });

  test("a client over the markdown rate limit gets HTML", async () => {
    const keys: string[] = [],
      { ai, calls } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown", { "cf-connecting-ip": "203.0.113.7" }),
        {
          AI: ai,
          MARKDOWN_RATE_LIMITER: {
            limit: ({ key }) => {
              keys.push(key);
              return Promise.resolve({ success: false });
            },
          },
        },
        render
      );
    expect(keys).toEqual(["203.0.113.7"]);
    expect(calls).toHaveLength(0);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  test("a rate limiter that fails serves the HTML, not an error", async () => {
    const { ai, calls } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown"),
        {
          AI: ai,
          MARKDOWN_RATE_LIMITER: {
            limit: () => Promise.reject(new Error("binding unavailable")),
          },
        },
        render
      );
    expect(calls).toHaveLength(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});

describe("a page served as HTML still revalidates", () => {
  test.each([
    ["without the AI binding", {} as MarkdownEnv],
    [
      "over the markdown rate limit",
      {
        AI: fakeAi().ai,
        MARKDOWN_RATE_LIMITER: {
          limit: () => Promise.resolve({ success: false }),
        },
      } as MarkdownEnv,
    ],
  ])("%s, the HTML's own ETag gets a 304", async (_label, env) => {
    const { body, state } = trackedBody(),
      { render } = renderer(() => htmlResponse(body)),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": ETAG }),
        env,
        render
      );
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(ETAG);
    expect(response.headers.get("vary")).toContain("Accept");
    expect(state.cancelled).toBe(true);
  });

  test("when the conversion fails, the HTML's own ETag gets a 304", async () => {
    const { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": ETAG }),
        { AI: fakeAi(() => Promise.reject(new Error("AI down"))).ai },
        render
      );
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(ETAG);
  });

  test("the 304 keeps the page's other Vary dimensions", async () => {
    const { render } = renderer(() =>
        htmlResponse(PAGE_HTML, { vary: "Accept-Encoding" })
      ),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": ETAG }),
        {},
        render
      );
    expect(response.status).toBe(304);
    expect(response.headers.get("vary")).toBe("Accept-Encoding, Accept");
  });

  test("another ETag still gets the full HTML", async () => {
    const { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": '"old"' }),
        {},
        render
      );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(PAGE_HTML);
  });
});

describe("a file that is not a page", () => {
  const FILE = "https://digest.law/skos.jsonld";

  test.each(["GET", "HEAD"])(
    "is rendered as asked (%s), conditions included",
    async (method) => {
      const { ai, calls } = fakeAi(),
        { render, seen } = renderer(
          () => new Response(null, { headers: { etag: ETAG }, status: 304 })
        ),
        response = await negotiateMarkdown(
          new Request(FILE, {
            headers: { accept: "text/markdown", "if-none-match": ETAG },
            method,
          }),
          { AI: ai },
          render
        );
      expect(seen[0]?.method).toBe(method);
      expect(seen[0]?.headers.get("if-none-match")).toBe(ETAG);
      expect(response.status).toBe(304);
      expect(calls).toHaveLength(0);
    }
  );

  test("an .html path is still a page", async () => {
    const { ai, calls } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        new Request("https://digest.law/404.html", {
          headers: { accept: "text/markdown" },
        }),
        { AI: ai },
        render
      );
    expect(calls).toHaveLength(1);
    expect(response.headers.get("content-type")).toContain("text/markdown");
  });
});

describe("the conversion cache", () => {
  test("a second request for the same build is served from cache", async () => {
    const { ai, calls } = fakeAi(),
      { cache } = fakeCache(),
      { render } = renderer(),
      first = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render,
        {
          cache,
        }
      ),
      // oxlint-disable-next-line eslint/sort-vars -- second must run after first fills the cache
      second = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render,
        { cache }
      );
    expect(calls).toHaveLength(1);
    expect(await first.text()).toBe(await second.text());
    expect(second.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
  });

  test("a cache hit does not spend the rate limit", async () => {
    const keys: string[] = [],
      { ai } = fakeAi(),
      { cache } = fakeCache(),
      { render } = renderer();
    // oxlint-disable-next-line eslint/one-var -- env needs ai from fakeAi above
    const env: MarkdownEnv = {
      AI: ai,
      MARKDOWN_RATE_LIMITER: {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: true });
        },
      },
    };
    await negotiateMarkdown(get("text/markdown"), env, render, { cache });
    await negotiateMarkdown(get("text/markdown"), env, render, { cache });
    expect(keys).toHaveLength(1);
  });

  test("a new build (new ETag) is converted again", async () => {
    let etag = '"one"';
    const { ai, calls } = fakeAi(),
      { cache } = fakeCache(),
      { render } = renderer(() => htmlResponse(PAGE_HTML, { etag }));
    await negotiateMarkdown(get("text/markdown"), { AI: ai }, render, {
      cache,
    });
    etag = '"two"';
    await negotiateMarkdown(get("text/markdown"), { AI: ai }, render, {
      cache,
    });
    expect(calls).toHaveLength(2);
  });

  test("a page without an ETag is converted but not cached", async () => {
    const { ai } = fakeAi(),
      { cache, store } = fakeCache(),
      { render } = renderer(
        () =>
          new Response(PAGE_HTML, {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
      ),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render,
        { cache }
      );
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(store.size).toBe(0);
  });

  test("a failed conversion is not cached", async () => {
    const { ai } = fakeAi(() => Promise.reject(new Error("AI down"))),
      { cache, store } = fakeCache(),
      { render } = renderer();
    await negotiateMarkdown(get("text/markdown"), { AI: ai }, render, {
      cache,
    });
    expect(store.size).toBe(0);
  });

  test("the cache write goes through waitUntil when there is one", async () => {
    const pending: Promise<unknown>[] = [],
      { ai } = fakeAi(),
      { cache, store } = fakeCache(),
      { render } = renderer();
    await negotiateMarkdown(get("text/markdown"), { AI: ai }, render, {
      cache,
      waitUntil: (promise) => {
        pending.push(promise);
      },
    });
    await Promise.all(pending);
    expect(pending).toHaveLength(1);
    expect(store.size).toBe(1);
  });
});

describe("a HEAD sends no body", () => {
  test("and releases the page body it falls back on", async () => {
    const { body, state } = trackedBody(),
      { render } = renderer(() => htmlResponse(body)),
      response = await negotiateMarkdown(head(), {}, render);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(state.cancelled).toBe(true);
  });
});

describe("revalidation", () => {
  test("the markdown carries its own weak ETag, derived from the page's", async () => {
    const { ai } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(response.headers.get("etag")).toBe(MARKDOWN_ETAG);
  });

  test("a weak page ETag gives the same markdown ETag", async () => {
    const { ai } = fakeAi(),
      { render } = renderer(() =>
        htmlResponse(PAGE_HTML, { etag: 'W/"abc123"' })
      ),
      response = await negotiateMarkdown(
        get("text/markdown"),
        { AI: ai },
        render
      );
    expect(response.headers.get("etag")).toBe(MARKDOWN_ETAG);
  });

  test("a copy served from cache keeps that ETag", async () => {
    const { ai } = fakeAi(),
      { cache } = fakeCache(),
      { render } = renderer();
    await negotiateMarkdown(get("text/markdown"), { AI: ai }, render, {
      cache,
    });
    // oxlint-disable-next-line eslint/one-var -- the cache is filled above
    const hit = await negotiateMarkdown(
      get("text/markdown"),
      { AI: ai },
      render,
      { cache }
    );
    expect(hit.headers.get("etag")).toBe(MARKDOWN_ETAG);
  });

  test.each([
    ["its ETag", MARKDOWN_ETAG],
    ["its ETag, compared weakly", '"md-abc123"'],
    ["its ETag among others", `"other", ${MARKDOWN_ETAG}`],
    ["the wildcard", "*"],
  ])(
    "If-None-Match with %s is a 304, converted by no one",
    async (_label, tag) => {
      const { ai, calls } = fakeAi(),
        { body, state } = trackedBody(),
        limited: string[] = [],
        { render } = renderer(() => htmlResponse(body)),
        response = await negotiateMarkdown(
          get("text/markdown", { "if-none-match": tag }),
          {
            AI: ai,
            MARKDOWN_RATE_LIMITER: {
              limit: ({ key }) => {
                limited.push(key);
                return Promise.resolve({ success: true });
              },
            },
          },
          render
        );
      expect(response.status).toBe(304);
      expect(await response.text()).toBe("");
      expect(response.headers.get("etag")).toBe(MARKDOWN_ETAG);
      expect(response.headers.get("vary")).toContain("Accept");
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=0, must-revalidate"
      );
      expect(calls).toHaveLength(0);
      expect(limited).toHaveLength(0);
      expect(state.cancelled).toBe(true);
    }
  );

  test("the HTML's own ETag does not revalidate the markdown", async () => {
    const { ai, calls } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": ETAG }),
        { AI: ai },
        render
      );
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test("a stale ETag from an older build is converted again", async () => {
    const { ai, calls } = fakeAi(),
      { render } = renderer(),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": 'W/"md-older"' }),
        { AI: ai },
        render
      );
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test("a page without an ETag gives markdown without one, never a 304", async () => {
    const { ai } = fakeAi(),
      { render } = renderer(
        () =>
          new Response(PAGE_HTML, {
            headers: { "content-type": "text/html; charset=utf-8" },
          })
      ),
      response = await negotiateMarkdown(
        get("text/markdown", { "if-none-match": "*" }),
        { AI: ai },
        render
      );
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBeNull();
  });
});

describe("varyOnAccept", () => {
  test("adds Accept to an HTML response", () => {
    expect(varyOnAccept(htmlResponse()).headers.get("vary")).toBe("Accept");
  });

  test("keeps an existing Vary value", () => {
    const vary = varyOnAccept(
      htmlResponse(PAGE_HTML, { vary: "Accept-Encoding" })
    ).headers.get("vary");
    expect(vary).toBe("Accept-Encoding, Accept");
  });

  test("does not repeat Accept", () => {
    const vary = varyOnAccept(
      htmlResponse(PAGE_HTML, { vary: "accept" })
    ).headers.get("vary");
    expect(vary).toBe("accept");
  });

  test("leaves non-HTML responses alone", () => {
    expect(varyOnAccept(Response.json({})).headers.get("vary")).toBeNull();
  });
});

describe("through the Worker", () => {
  test("an agent asking for markdown gets markdown with discovery links", async () => {
    const { ai } = fakeAi(),
      env = {
        AI: ai,
        ASSETS: { fetch: () => Promise.resolve(htmlResponse()) },
      } as unknown as WorkerEnv,
      response = await worker.fetch(get("text/markdown"), env);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("link")).toContain('rel="api-catalog"');
  });

  test("a browser gets HTML that varies on Accept", async () => {
    const { ai, calls } = fakeAi(),
      env = {
        AI: ai,
        ASSETS: { fetch: () => Promise.resolve(htmlResponse()) },
      } as unknown as WorkerEnv,
      response = await worker.fetch(get(BROWSER), env);
    expect(calls).toHaveLength(0);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("vary")).toContain("Accept");
  });

  test("POST /mcp is not negotiated", async () => {
    const { ai, calls } = fakeAi(),
      env = {
        AI: ai,
        ASSETS: { fetch: () => Promise.resolve(Response.json({})) },
      } as unknown as WorkerEnv,
      response = await worker.fetch(
        new Request("https://digest.law/mcp", {
          body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "ping" }),
          headers: {
            accept: "text/markdown",
            "content-type": "application/json",
          },
          method: "POST",
        }),
        env
      );
    expect(calls).toHaveLength(0);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  test("wrangler binds Workers AI as AI", async () => {
    expect(await wranglerConfig()).toMatch(
      /"ai":\s*\{\s*"binding":\s*"AI"\s*\}/u
    );
  });

  test("markdown has its own rate limit, apart from /mcp's", async () => {
    const config = await wranglerConfig();
    expect(config).toMatch(
      /"name": "MARKDOWN_RATE_LIMITER",\s*"namespace_id": "2102",\s*"simple": \{ "limit": 60, "period": 60 \}/u
    );
  });
});
