/**
 * digest.law Worker — static assets, plus the one endpoint that is not static.
 *
 * The site is a fully pre-rendered Astro build served from the assets
 * binding. This Worker exists solely so /contact/ has somewhere to POST:
 * it validates a submission and hands it to Cloudflare Email Sending via the
 * `send_email` binding. Everything else falls through to the assets.
 *
 * Recipients are NOT taken from the request. The topic id selects a
 * recipient list from src/lib/committee.ts, and `allowed_destination_addresses`
 * in wrangler.jsonc closes the set again at the platform level — so a bug
 * here still cannot turn the endpoint into an open relay.
 */

import { LIMITS, topicById } from "../src/lib/committee";

interface SendEmailMessage {
  from: { email: string; name?: string };
  html?: string;
  replyTo?: string;
  subject: string;
  text?: string;
  to: string[] | string;
}

interface SendEmailBinding {
  send: (message: SendEmailMessage) => Promise<{ messageId?: string }>;
}

interface AssetFetcher {
  fetch: (request: Request) => Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
  CONTACT_EMAIL: SendEmailBinding;
  /**
   * dist/ is split across several Workers to stay under the 100k
   * files-per-Worker cap: top-level folder → service-binding name, alongside
   * one SHARD_* binding per shard Worker. Both are generated into the deploy
   * config by scripts/deploy-shards.ts; absent under `wrangler dev`, where
   * ASSETS still holds all of dist.
   */
  SHARD_MAP?: Record<string, string>;
}

/** Envelope sender. Must be on a domain onboarded to Email Sending. */
const FROM = { email: "forms@digest.law", name: "digest.law contact form" };

/** Only these origins may post the form. */
const ALLOWED_ORIGINS = new Set([
  "https://digest.law",
  "https://www.digest.law",
]);

const MAX_BODY_BYTES = 32_000;

/**
 * Collapse control characters to spaces. The send binding takes structured
 * fields rather than raw MIME, so this is belt-and-braces against header
 * injection via `subject` / `replyTo`, and it keeps stray terminal escapes
 * out of somebody's mail client.
 */
// oxlint-disable-next-line no-control-regex -- matching them is the point
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/gu;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replaceAll(CONTROL_CHARS, " ").trim().slice(0, max);
}

/** Same, but keeps the paragraph breaks — for the message body only. */
function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replaceAll(/\r\n?/gu, "\n")
    .replaceAll(CONTROL_CHARS, (c) => (c === "\n" ? c : " "))
    .trim()
    .slice(0, max);
}

/** Deliberately permissive — the real check is whether a reply arrives. */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

interface Submission {
  consent: boolean;
  email: string;
  message: string;
  name: string;
  organization: string;
  topic: string;
  website: string;
}

async function readSubmission(request: Request): Promise<Submission | null> {
  const type = request.headers.get("content-type") ?? "";
  let raw: Record<string, unknown>;

  if (type.includes("application/json")) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return null;
    }
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (
    type.includes("form-data") ||
    type.includes("application/x-www-form-urlencoded")
  ) {
    const form = await request.formData();
    raw = Object.fromEntries(form.entries());
  } else {
    return null;
  }

  return {
    consent:
      raw.consent === "on" || raw.consent === true || raw.consent === "true",
    email: clean(raw.email, LIMITS.email),
    message: cleanMultiline(raw.message, LIMITS.message),
    name: clean(raw.name, LIMITS.name),
    organization: clean(raw.organization, LIMITS.organization),
    topic: clean(raw.topic, 40),
    website: clean(raw.website, 200),
  };
}

function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

/** Minimal styled confirmation for the no-JavaScript path. */
function htmlPage(heading: string, body: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)} — American Legal Digest</title>
<style>
  :root { color-scheme: light dark }
  body { margin:0; min-height:100svh; display:flex; align-items:center;
         justify-content:center; padding:2rem;
         font:16px/1.6 ui-sans-serif,system-ui,sans-serif }
  main { max-width:44ch }
  h1 { font-size:1.6rem; font-weight:500; letter-spacing:-.03em; margin:0 0 .75rem }
  p { margin:0 0 1.25rem; opacity:.8 }
  a { color:inherit }
</style></head><body><main>
<h1>${escapeHtml(heading)}</h1><p>${body}</p>
<p><a href="/contact/">← Back to contact</a> · <a href="/">digest.law</a></p>
</main></body></html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8" },
      status,
    }
  );
}

function fail(request: Request, message: string, status: number): Response {
  if (wantsJson(request)) {
    return Response.json({ error: message }, { status });
  }
  return htmlPage("That did not send", escapeHtml(message), status);
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return fail(request, "Use POST.", 405);
  }

  // Same-origin only. Not a real defence against a determined sender, but it
  // stops the drive-by form spam that finds every public POST endpoint.
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return fail(request, "Cross-origin submissions are not accepted.", 403);
  }

  // Cheap guard before touching the body at all — the JSON path re-checks
  // after reading, since Content-Length is a claim, not a promise.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return fail(request, "That message is too long.", 413);
  }

  const submission = await readSubmission(request);
  if (!submission) {
    return fail(request, "Could not read that submission.", 400);
  }

  // Bot trap: accept and discard, so the sender learns nothing from the reply.
  if (submission.website !== "") {
    return wantsJson(request)
      ? Response.json({ ok: true, routedTo: [] })
      : htmlPage("Received", "Thank you — your message is in.", 200);
  }

  const topic = topicById(submission.topic);
  if (!topic) {
    return fail(request, "Pick a topic from the list.", 400);
  }
  if (!submission.consent) {
    return fail(request, "The acknowledgement is required.", 400);
  }
  if (submission.name === "" || submission.message === "") {
    return fail(request, "Name and message are required.", 400);
  }
  if (!isEmail(submission.email)) {
    return fail(request, "That email address does not look valid.", 400);
  }

  const lines = [
    `Topic:        ${topic.label}`,
    `Name:         ${submission.name}`,
    `Email:        ${submission.email}`,
    `Organization: ${submission.organization || "—"}`,
    "",
    submission.message,
    "",
    "— sent from the digest.law contact form",
  ];

  try {
    await env.CONTACT_EMAIL.send({
      from: FROM,
      html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(lines.join("\n"))}</pre>`,
      replyTo: submission.email,
      subject: `[digest.law] ${topic.label} — ${submission.name}`,
      text: lines.join("\n"),
      to: topic.to,
    });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "unknown";
    console.error(`[contact] send failed: ${code} ${String(error)}`);
    return fail(
      request,
      "The message could not be delivered. Please write to arthur@digest.law directly.",
      502
    );
  }

  if (wantsJson(request)) {
    return Response.json({ ok: true, routedTo: topic.to });
  }
  return htmlPage(
    "Received",
    `Your message is with ${topic.to.map(escapeHtml).join(" and ")}. If it is a correction and it holds up, it ships as a commit you will be able to read.`,
    200
  );
}

/**
 * Identity resolution — `/id/{concept-id}` (P1-001, P1-002, P1-014G).
 *
 * This is where `https://w3id.org/digest-law/concept/{id}` lands. Concept ids
 * are permanent; routes are not, so the redirect is resolved at request time
 * from the id map rather than baked into a redirect list.
 *
 * Status codes carry meaning here:
 *   301  the concept lives at this route today
 *   410  the concept is retired — it existed, it is gone, and its id is never
 *        reused. A 404 would wrongly suggest it never existed.
 *   404  no such id
 *
 * Content negotiation is deliberately NOT implemented: there is no per-concept
 * JSON-LD endpoint yet, so an Accept-driven branch would have nothing honest
 * to point at. The whole graph is at /skos.jsonld. Tracked with P1-014G.
 */
const CONCEPT_ID = /^[0-9a-f]{32}$/u;

interface IdMap {
  retired: Record<string, string>;
  routes: Record<string, string>;
}

let idMapPromise: Promise<IdMap | null> | null = null;

/**
 * Never throws. A rejected fetch or a body that will not parse has to come
 * back as null, because the caller caches this promise for the life of the
 * isolate: a cached *rejection* would turn one transient blip into a permanent
 * 500 on every later /id/ request, with no path back short of a redeploy.
 *
 * A map missing either half is treated as no map at all. Half a map answers
 * wrongly rather than not at all — without `retired`, a tombstoned id 404s,
 * which claims the concept never existed.
 */
async function loadIdMap(request: Request, env: Env): Promise<IdMap | null> {
  try {
    const response = await env.ASSETS.fetch(
      new Request(new URL("/id-map.json", request.url), { method: "GET" })
    );
    if (!response.ok) {
      return null;
    }
    const map = (await response.json()) as IdMap | null;
    return map?.routes && map.retired ? map : null;
  } catch {
    return null;
  }
}

/** Test seam: the map is cached for the isolate's life, not per request. */
export function resetIdMapCache(): void {
  idMapPromise = null;
}

export async function handleConceptId(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  if (!(request.method === "GET" || request.method === "HEAD")) {
    return new Response("Method not allowed", {
      headers: { Allow: "GET, HEAD" },
      status: 405,
    });
  }
  if (!CONCEPT_ID.test(id)) {
    return new Response("A concept id is 32 lowercase hex characters.\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 404,
    });
  }
  // Cached for the life of the isolate; the map only changes on deploy.
  idMapPromise ??= loadIdMap(request, env);
  const map = await idMapPromise;
  if (!map) {
    idMapPromise = null;
    return new Response("Identity map unavailable.\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 503,
    });
  }

  const route = map.routes[id];
  if (route) {
    return Response.redirect(
      new URL(`/${route}/`, request.url).toString(),
      301
    );
  }
  const gone = map.retired[id];
  if (gone) {
    return new Response(
      `Concept ${id} has been retired. Its last route was /${gone}/.\n` +
        "The identifier is never reused and never reassigned.\n",
      {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        status: 410,
      }
    );
  }
  return new Response(`No concept with id ${id}.\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status: 404,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/contact") {
      return await handleContact(request, env);
    }
    const conceptId = /^\/id\/(?<id>[^/]+)\/?$/u.exec(pathname);
    if (conceptId) {
      return await handleConceptId(
        request,
        env,
        (conceptId.groups?.id ?? "").toLowerCase()
      );
    }
    // The shard rules in run_worker_first are prefix globs, so a root file
    // like /sitemap-index.xml can land here via the /sitemap* rule — only an
    // exact first-segment match forwards; everything else is a root asset.
    const segment = pathname.split("/")[1] ?? "";
    const bindingName = env.SHARD_MAP?.[segment];
    if (bindingName) {
      const shard = (
        env as unknown as Record<string, AssetFetcher | undefined>
      )[bindingName];
      if (shard) {
        return await shard.fetch(request);
      }
    }
    return await env.ASSETS.fetch(request);
  },
};
