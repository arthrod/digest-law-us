/**
 * The concept-identity resolver: what `w3id.org/digest-law/concept/{id}`
 * lands on (P1-001, P1-002, P1-014G).
 */
import { beforeEach, describe, expect, test } from "bun:test";

import worker, { handleConceptId, resetIdMapCache } from "./index";

const LIVE = "9460d81470154e458335365e3b4c5014";
const GONE = "00000000000000000000000000000009";

const MAP = {
  retired: { [GONE]: "evidence-law/withdrawn-topic" },
  routes: { [LIVE]: "evidence-law/proof-of-writings" },
  version: 1,
};

function envWith(map: unknown, ok = true) {
  return {
    ASSETS: {
      fetch: () =>
        Promise.resolve(
          ok ? Response.json(map) : new Response("nope", { status: 500 })
        ),
    },
  } as unknown as Parameters<typeof handleConceptId>[1];
}

/** ASSETS whose fetch rejects outright, rather than answering non-ok. */
function throwingEnv() {
  return {
    ASSETS: { fetch: () => Promise.reject(new Error("network")) },
  } as unknown as Parameters<typeof handleConceptId>[1];
}

/** ASSETS that answers 200 with a body that is not JSON. */
function brokenJsonEnv() {
  return {
    ASSETS: {
      fetch: () =>
        Promise.resolve(new Response("{ truncated", { status: 200 })),
    },
  } as unknown as Parameters<typeof handleConceptId>[1];
}

const get = (id: string, method = "GET") =>
  new Request(`https://digest.law/id/${id}`, { method });

beforeEach(() => {
  resetIdMapCache();
});

describe("resolving a concept id", () => {
  test("a live concept redirects to its current route", async () => {
    const response = await handleConceptId(get(LIVE), envWith(MAP), LIVE);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://digest.law/evidence-law/proof-of-writings/"
    );
  });

  test("a retired concept is 410 Gone, not 404", async () => {
    // 404 would say the identifier never existed. It did, and it is never
    // reused — the tombstone is the honest answer.
    const response = await handleConceptId(get(GONE), envWith(MAP), GONE);
    expect(response.status).toBe(410);
    expect(await response.text()).toContain("evidence-law/withdrawn-topic");
  });

  test("an unknown but well-formed id is 404", async () => {
    const missing = "f".repeat(32);
    const response = await handleConceptId(get(missing), envWith(MAP), missing);
    expect(response.status).toBe(404);
  });

  test("a malformed id is 404 and says what an id looks like", async () => {
    const response = await handleConceptId(
      get("not-an-id"),
      envWith(MAP),
      "not-an-id"
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("32 lowercase hex");
  });

  test("HEAD is allowed; POST is not", async () => {
    const head = await handleConceptId(get(LIVE, "HEAD"), envWith(MAP), LIVE);
    expect(head.status).toBe(301);
    const post = await handleConceptId(get(LIVE, "POST"), envWith(MAP), LIVE);
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
  });

  test("an unavailable id map is 503, not a wrong redirect", async () => {
    const response = await handleConceptId(
      get(LIVE),
      envWith(MAP, false),
      LIVE
    );
    expect(response.status).toBe(503);
  });

  test("a failed load is not cached, so the next request retries", async () => {
    await handleConceptId(get(LIVE), envWith(MAP, false), LIVE);
    const retry = await handleConceptId(get(LIVE), envWith(MAP), LIVE);
    expect(retry.status).toBe(301);
  });

  test("a load that throws is 503, and is not cached either", async () => {
    // A non-ok response is only one way to fail: the fetch itself can reject.
    // Caching the rejected promise would 500 every later /id/ request for the
    // life of the isolate — one blip, permanent outage, no recovery.
    const first = await handleConceptId(get(LIVE), throwingEnv(), LIVE);
    expect(first.status).toBe(503);
    const retry = await handleConceptId(get(LIVE), envWith(MAP), LIVE);
    expect(retry.status).toBe(301);
  });

  test("a truncated id map is 503, not an unhandled parse error", async () => {
    // A 200 that is not JSON: the asset was cut off or half-deployed.
    const response = await handleConceptId(get(LIVE), brokenJsonEnv(), LIVE);
    expect(response.status).toBe(503);
  });
});

describe("routing", () => {
  /** ASSETS answers the id map for /id-map.json and a page for anything else. */
  function routedEnv() {
    return {
      ASSETS: {
        fetch: (request: Request) =>
          Promise.resolve(
            new URL(request.url).pathname === "/id-map.json"
              ? Response.json(MAP)
              : new Response("<html>page</html>", { status: 200 })
          ),
      },
    } as unknown as Parameters<typeof worker.fetch>[1];
  }

  test("/id/{id} reaches the resolver, with or without a trailing slash", async () => {
    for (const url of [
      `https://digest.law/id/${LIVE}`,
      `https://digest.law/id/${LIVE}/`,
    ]) {
      const response = await worker.fetch(new Request(url), routedEnv());
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(
        "https://digest.law/evidence-law/proof-of-writings/"
      );
    }
  });

  test("an uppercase id resolves — hex case is not identity", async () => {
    const response = await worker.fetch(
      new Request(`https://digest.law/id/${LIVE.toUpperCase()}`),
      routedEnv()
    );
    expect(response.status).toBe(301);
  });

  test("everything else still falls through to the assets", async () => {
    const response = await worker.fetch(
      new Request("https://digest.law/evidence-law/"),
      routedEnv()
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("page");
  });
});
