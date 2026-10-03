/**
 * Retained-source pages: never indexed, and full texts of copyrighted
 * scholarship (law reviews, SSRN) are withheld with a 451 that links the
 * origin. Digest pages are untouched.
 */
import { describe, expect, test } from "bun:test";

import worker from "./index";
import {
  applyPagePolicy,
  applySourcePolicy,
  isBlockedOrigin,
  originOf,
} from "./source-policy";

const SRC =
    "/jurisprudence-and-legal-method/rules-of-construction/contemporaneous-exposition-rule/sources/textualism-s-mistake-harvard-law-review/",
  TOPIC =
    "/jurisprudence-and-legal-method/rules-of-construction/contemporaneous-exposition-rule/",
  html = (body: string, status = 200) =>
    new Response(body, {
      headers: { "content-type": "text/html; charset=utf-8" },
      status,
    }),
  page = (origin: string) =>
    `<html><body><h1>T</h1><a href="${origin}" class="x" rel="nofollow">Origin: ${origin.slice(8, 30)}…</a><p>full text</p></body></html>`;

describe("origin detection", () => {
  test("reads the Origin link a source page renders", () => {
    expect(
      originOf(
        page("https://harvardlawreview.org/print/vol-135/textualisms-mistake/")
      )
    ).toBe("https://harvardlawreview.org/print/vol-135/textualisms-mistake/");
    expect(originOf("<p>no origin here</p>")).toBeUndefined();
  });

  test("law reviews and SSRN are blocked; edicts and open sources are not", () => {
    for (const u of [
      "https://harvardlawreview.org/print/vol-135/x/",
      "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1",
      "https://www.ssrn.com/abstract=2",
      "https://www.yalelawjournal.org/article/x",
      "https://lawreview.uchicago.edu/print-archive/x",
      "https://www.stanfordlawreview.org/print/article/x/",
      "https://columbialawreview.org/content/x/",
    ]) {
      expect(isBlockedOrigin(u)).toBe(true);
    }
    for (const u of [
      "https://www.law.cornell.edu/uscode/text/5/554",
      "https://www.govinfo.gov/app/details/X",
      "https://www.courtlistener.com/opinion/1/x/",
      "https://www.supremecourt.gov/opinions/x.pdf",
      "not a url",
    ]) {
      expect(isBlockedOrigin(u)).toBe(false);
    }
  });
});

describe("applySourcePolicy", () => {
  test("source pages are noindex, noarchive and keep their body", async () => {
    const res = await applySourcePolicy(
      SRC.replace("textualism", "cfr"),
      html(page("https://www.govinfo.gov/x"))
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    expect(await res.text()).toContain("full text");
  });

  test("a blocked source answers 451, names the origin and drops the text", async () => {
    const res = await applySourcePolicy(
      SRC,
      html(
        page("https://harvardlawreview.org/print/vol-135/textualisms-mistake/")
      )
    );
    expect(res.status).toBe(451);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    const body = await res.text();
    expect(body).toContain(
      'href="https://harvardlawreview.org/print/vol-135/textualisms-mistake/"'
    );
    expect(body).not.toContain("full text");
  });

  test("digest pages and non-HTML responses are untouched", async () => {
    const topic = html("<p>digest</p>");
    expect(await applySourcePolicy(TOPIC, topic)).toBe(topic);
    const json = new Response("{}", {
      headers: { "content-type": "application/json" },
    });
    expect(await applySourcePolicy(`${SRC}index.json`, json)).toBe(json);
  });

  test("an error response from a shard passes through", async () => {
    const missing = html("not found", 404);
    expect(await applySourcePolicy(SRC, missing)).toBe(missing);
  });
});

describe("wired into the Worker", () => {
  const shardEnv = (body: string) =>
    ({
      ASSETS: { fetch: () => Promise.resolve(html("<p>root</p>")) },
      SHARD_JURIS: { fetch: () => Promise.resolve(html(body)) },
      SHARD_MAP: { "jurisprudence-and-legal-method": "SHARD_JURIS" },
    }) as unknown as Parameters<typeof worker.fetch>[1];

  test("a source page served by a shard is noindex", async () => {
    const res = await worker.fetch(
      new Request(`https://digest.law${SRC.replace("textualism", "cfr")}`),
      shardEnv(page("https://www.govinfo.gov/x"))
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex, noarchive");
  });

  test("a blocked source served by a shard answers 451", async () => {
    const res = await worker.fetch(
      new Request(`https://digest.law${SRC}`),
      shardEnv(page("https://harvardlawreview.org/print/vol-135/x/"))
    );
    expect(res.status).toBe(451);
  });

  test("a topic page from a shard carries no robots header", async () => {
    const res = await worker.fetch(
      new Request(`https://digest.law${TOPIC}`),
      shardEnv("<p>digest</p>")
    );
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("review claim on rendered pages", () => {
  test("the provenance strip stops saying review-gated", async () => {
    const res = await applyPagePolicy(
        TOPIC,
        html(
          '<span class="text-ink-muted">Machine-researched · review-gated</span>'
        )
      ),
      body = await res.text();
    expect(body).not.toContain("review-gated");
    expect(body).toContain(
      "Machine-researched · machine-reviewed · not reviewed by a lawyer"
    );
  });

  test("a rewritten page drops the ETag of the unmodified asset", async () => {
    const r = new Response("<span>Machine-researched · review-gated</span>", {
      headers: { "content-type": "text/html", etag: '"abc"' },
    });
    const out = await applyPagePolicy(TOPIC, r);
    expect(out.headers.get("etag")).toBeNull();
  });

  test("a shard topic page is rewritten through the Worker", async () => {
    const env = {
        ASSETS: { fetch: () => Promise.resolve(html("<p>root</p>")) },
        SHARD_J: {
          fetch: () =>
            Promise.resolve(
              html("<span>Machine-researched · review-gated</span>")
            ),
        },
        SHARD_MAP: { "jurisprudence-and-legal-method": "SHARD_J" },
      } as unknown as Parameters<typeof worker.fetch>[1],
      res = await worker.fetch(new Request(`https://digest.law${TOPIC}`), env);
    expect(await res.text()).not.toContain("review-gated");
  });

  test("pages without the claim and non-HTML pass through untouched", async () => {
    const plain = html("<p>nothing to change</p>");
    const out = await applyPagePolicy(TOPIC, plain);
    expect(await out.text()).toBe("<p>nothing to change</p>");
    const json = new Response('{"x":"review-gated"}', {
      headers: { "content-type": "application/json" },
    });
    expect(await applyPagePolicy("/skos.jsonld", json)).toBe(json);
  });
});
