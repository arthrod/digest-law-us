/**
 * Markdown for agents: content negotiation on `Accept: text/markdown`.
 *
 * digest.law is on the Free plan, where the zone-level "Markdown for Agents"
 * switch is unavailable (Pro and up), so the root Worker does the same job:
 * it renders the page as usual, converts the HTML with Workers AI
 * `toMarkdown()` — free for HTML; only image conversion runs billed models —
 * and answers `text/markdown`. Browsers never ask for markdown, so they never
 * reach this path; they get the HTML with `Vary: Accept`.
 *
 * Every failure falls back to the HTML: no AI binding (wrangler dev), a
 * converter error, a page over MAX_HTML_BYTES, a client over its rate limit.
 * An agent that asked for markdown and got HTML can still read the page; an
 * agent that got a 5xx cannot.
 *
 * Conversions are cached with the Cache API under a key built from the
 * page's path and its ETag, so a new build (new ETag) is converted afresh and
 * the cached markdown is never served at the HTML URL's own cache key.
 */

import { CONTENT_SIGNAL } from "../src/lib/robots";

/** One result of `env.AI.toMarkdown()`. */
export interface MarkdownConversion {
  data?: string;
  error?: string;
  format: "error" | "markdown" | "text";
  name?: string;
  tokens?: number;
}

/** The slice of the Workers AI binding this module uses. */
export interface MarkdownAi {
  toMarkdown: (
    document: { blob: Blob; name: string },
    options?: {
      conversionOptions?: {
        html?: { cssSelector?: string; hostname?: string };
      };
    }
  ) => Promise<MarkdownConversion | MarkdownConversion[]>;
}

/** The slice of the Cache API (`caches.default`) this module uses. */
export interface MarkdownCache {
  match: (key: Request) => Promise<Response | undefined>;
  put: (key: Request, response: Response) => Promise<void>;
}

export interface MarkdownEnv {
  AI?: MarkdownAi;
  /** Conversions per client IP; cache hits do not count. Its own binding:
   *  `MCP_RATE_LIMITER` belongs to /mcp alone (AGENTS.md). */
  MARKDOWN_RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
}

export interface MarkdownOptions {
  cache?: MarkdownCache;
  waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * Pages larger than this are served as HTML. 2 MiB keeps a conversion well
 * inside one Worker invocation's memory and CPU; Cloudflare's own zone
 * feature stops at 6 MiB. 30 of the 357,760 pages in the 2026-11-03 build
 * are larger (area indexes and a few retained sources).
 */
export const MAX_HTML_BYTES = 2 * 1024 * 1024;

/** Converted pages are keyed by ETag, so they can be kept for a long time. */
// oxlint-disable-next-line eslint/one-var -- an exported const cannot join this private list
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60,
  /** A conditional request would get a 304 for the HTML, with nothing to convert. */
  CONDITIONAL_HEADERS = [
    "if-match",
    "if-modified-since",
    "if-none-match",
    "if-range",
    "if-unmodified-since",
    "range",
  ],
  MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8",
  MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);

/** The q-value of one Accept range; 1 when absent, 0 when unparseable. */
function quality(params: string[]): number {
  for (const param of params) {
    const [name = "", value = ""] = param.split("=");
    if (name.trim().toLowerCase() === "q") {
      const q = Number(value.trim());
      return Number.isFinite(q) ? Math.min(1, Math.max(0, q)) : 0;
    }
  }
  return 1;
}

/**
 * True when the client names markdown and rates it at least as high as
 * HTML. Wildcards do not count: `*\/*` is a browser saying "anything", not
 * an agent asking for markdown.
 */
export function prefersMarkdown(accept: string | null): boolean {
  let html = 0,
    markdown = 0;
  for (const range of (accept ?? "").split(",")) {
    const [type = "", ...params] = range.split(";"),
      media = type.trim().toLowerCase(),
      q = quality(params);
    if (MARKDOWN_TYPES.has(media)) {
      markdown = Math.max(markdown, q);
    } else if (media === "text/html") {
      html = Math.max(html, q);
    }
  }
  return markdown > 0 && markdown >= html;
}

function contentTypeOf(response: Response): string {
  return (response.headers.get("content-type") ?? "").toLowerCase();
}

function isNegotiable(response: Response): boolean {
  const type = contentTypeOf(response);
  return type.includes("text/html") || type.includes("text/markdown");
}

/** `Vary: Accept` on every page that has a markdown twin. */
export function varyOnAccept(response: Response): Response {
  const vary = response.headers.get("vary");
  if (!isNegotiable(response)) {
    return response;
  }
  if (
    vary
      ?.split(",")
      .some((value) => ["*", "accept"].includes(value.trim().toLowerCase()))
  ) {
    return response;
  }
  // oxlint-disable-next-line eslint/one-var -- headers are copied only when Vary actually changes
  const headers = new Headers(response.headers);
  headers.set("vary", vary ? `${vary}, Accept` : "Accept");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** The page itself, as a plain unconditional GET for HTML. */
function forPage(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of CONDITIONAL_HEADERS) {
    headers.delete(name);
  }
  headers.set("accept", "text/html");
  return new Request(request.url, { headers, method: "GET" });
}

function pageUrl(request: Request): string {
  const { origin, pathname } = new URL(request.url);
  return `${origin}${pathname}`;
}

function cacheKey(request: Request, etag: string): Request {
  return new Request(
    `${pageUrl(request)}?markdown=${encodeURIComponent(etag)}`
  );
}

/** A HEAD gets the same headers as the GET, and no body: the body it would
 *  have had is cancelled, so the stream behind it is released, not left open. */
async function forMethod(
  request: Request,
  response: Response
): Promise<Response> {
  if (request.method !== "HEAD") {
    return response;
  }
  if (response.body && !response.body.locked) {
    await response.body.cancel();
  }
  return new Response(null, {
    headers: response.headers,
    status: response.status,
  });
}

/**
 * The markdown's own validator, derived from the page's. Weak: a converter
 * update may change the bytes of the same page's markdown, not its meaning.
 * Never the page's ETag itself, which names the HTML.
 */
export function markdownEtag(pageEtag: string): string {
  const opaque = pageEtag.replace(/^W\//u, "").replaceAll('"', "");
  return `W/"md-${opaque}"`;
}

/** An entity tag without its weakness marker, for weak comparison. */
function opaqueTag(tag: string): string {
  return tag.replace(/^W\//u, "");
}

/** If-None-Match against an ETag, compared weakly (RFC 9110 §13.1.2). */
function isFresh(request: Request, etag: string): boolean {
  const tags = request.headers
    .get("if-none-match")
    ?.match(/\*|(?:W\/)?"[^"]*"/gu);
  return (tags ?? []).some(
    (tag) => tag === "*" || opaqueTag(tag) === opaqueTag(etag)
  );
}

/** A 304 carries what the 200 would have said about caching (RFC 9110 §15.4.5). */
function notModified(etag: string, page: Response): Response {
  const headers = new Headers({ etag, vary: "Accept" }),
    pagePolicy = page.headers.get("cache-control");
  if (pagePolicy) {
    headers.set("cache-control", pagePolicy);
  }
  return new Response(null, { headers, status: 304 });
}

/** The client-facing caching policy is the page's, whatever was cached. */
function withPageCaching(response: Response, page: Response): Response {
  const headers = new Headers(response.headers),
    pagePolicy = page.headers.get("cache-control");
  if (pagePolicy) {
    headers.set("cache-control", pagePolicy);
  } else {
    headers.delete("cache-control");
  }
  return new Response(response.body, { headers, status: 200 });
}

function markdownResponse(
  conversion: MarkdownConversion,
  page: Response,
  etag: string | null
): Response {
  const headers = new Headers({
      "content-signal": CONTENT_SIGNAL,
      "content-type": MARKDOWN_CONTENT_TYPE,
      vary: "Accept",
      "x-content-type-options": "nosniff",
    }),
    link = page.headers.get("link");
  if (link) {
    headers.set("link", link);
  }
  if (etag) {
    headers.set("etag", etag);
  }
  if (typeof conversion.tokens === "number") {
    headers.set("x-markdown-tokens", String(conversion.tokens));
  }
  return new Response(conversion.data, { headers, status: 200 });
}

async function cached(
  cache: MarkdownCache | undefined,
  key: Request | null
): Promise<Response | undefined> {
  if (!(cache && key)) {
    return undefined;
  }
  try {
    return await cache.match(key);
  } catch {
    return undefined;
  }
}

function store(
  response: Response,
  key: Request | null,
  options: MarkdownOptions
): Promise<void> {
  const { cache, waitUntil } = options;
  if (!(cache && key)) {
    return Promise.resolve();
  }
  // oxlint-disable-next-line eslint/one-var -- only built once there is somewhere to put it
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
  // oxlint-disable-next-line eslint/one-var -- the put needs the headers above
  const put = cache
    .put(key, new Response(response.clone().body, { headers, status: 200 }))
    .catch((error: unknown) => {
      console.error(`[markdown] cache put failed: ${String(error)}`);
    });
  if (waitUntil) {
    waitUntil(put);
    return Promise.resolve();
  }
  return put;
}

async function convert(
  ai: MarkdownAi,
  html: ArrayBuffer,
  request: Request
): Promise<MarkdownConversion | null> {
  try {
    const result = await ai.toMarkdown(
        { blob: new Blob([html], { type: "text/html" }), name: "index.html" },
        { conversionOptions: { html: { hostname: pageUrl(request) } } }
      ),
      // oxlint-disable-next-line eslint/sort-vars -- conversion unwraps result (TDZ)
      conversion = Array.isArray(result) ? result[0] : result;
    return conversion?.format === "markdown" && conversion.data
      ? conversion
      : null;
  } catch (error) {
    console.error(`[markdown] toMarkdown failed: ${String(error)}`);
    return null;
  }
}

/**
 * The page itself, when it is what the client gets. The page was rendered
 * without the client's conditions (conversion needs its body), so its own
 * ETag is checked here: a client holding this HTML gets a 304, not the page
 * again. The markdown validator is separate; see `isFresh` above.
 */
async function asPage(request: Request, page: Response): Promise<Response> {
  const etag = page.headers.get("etag");
  if (page.status === 200 && etag && isFresh(request, etag)) {
    await page.body?.cancel();
    return notModified(etag, page);
  }
  return await forMethod(request, varyOnAccept(page));
}

/**
 * Only HTML can be converted, so a path naming another kind of file is
 * rendered exactly as asked: its own conditions and method reach the assets
 * (a HEAD or 304 for the 29 MiB skos.jsonld, not the whole file).
 */
function namesOtherFile(request: Request): boolean {
  const name = new URL(request.url).pathname.split("/").pop() ?? "";
  return /\.[^.]+$/u.test(name) && !/\.html?$/iu.test(name);
}

/** The page as rendered, from the bytes already read off its body. */
function asHtml(
  request: Request,
  page: Response,
  html: ArrayBuffer
): Promise<Response> {
  return asPage(
    request,
    new Response(html, {
      headers: page.headers,
      status: page.status,
      statusText: page.statusText,
    })
  );
}

/** False when over the limit, and when the limiter itself fails: the page
 *  is then served as HTML, like every other failure on this path. */
async function allowed(request: Request, env: MarkdownEnv): Promise<boolean> {
  const limiter = env.MARKDOWN_RATE_LIMITER;
  if (!limiter) {
    return true;
  }
  try {
    const { success } = await limiter.limit({
      key: request.headers.get("cf-connecting-ip") ?? "anon",
    });
    return success;
  } catch (error) {
    console.error(`[markdown] rate limiter failed: ${String(error)}`);
    return false;
  }
}

/**
 * Answer a GET or HEAD whose Accept prefers markdown (see prefersMarkdown).
 * `render` produces the page exactly as a browser would get it.
 */
export async function negotiateMarkdown(
  request: Request,
  env: MarkdownEnv,
  render: (request: Request) => Promise<Response>,
  options: MarkdownOptions = {}
): Promise<Response> {
  if (namesOtherFile(request)) {
    return varyOnAccept(await render(request));
  }
  // oxlint-disable-next-line eslint/one-var -- rendered only for a path that may be a page
  const page = await render(forPage(request)),
    { AI: ai } = env;
  if (
    !ai ||
    page.status !== 200 ||
    !contentTypeOf(page).includes("text/html")
  ) {
    return await asPage(request, page);
  }

  // oxlint-disable-next-line eslint/one-var -- the key needs a renderable HTML page first
  const etag = page.headers.get("etag"),
    key = etag ? cacheKey(request, etag) : null,
    // oxlint-disable-next-line eslint/sort-vars -- derived from the page's etag (TDZ)
    validator = etag ? markdownEtag(etag) : null;
  if (validator && isFresh(request, validator)) {
    await page.body?.cancel();
    return notModified(validator, page);
  }

  // oxlint-disable-next-line eslint/one-var -- only looked up when the client's copy is stale
  const hit = await cached(options.cache, key);
  if (hit) {
    await page.body?.cancel();
    return forMethod(request, withPageCaching(hit, page));
  }

  if (
    Number(page.headers.get("content-length")) > MAX_HTML_BYTES ||
    !(await allowed(request, env))
  ) {
    return await asPage(request, page);
  }

  // oxlint-disable-next-line eslint/one-var -- the body is read only once the page qualifies
  const html = await page.arrayBuffer();
  if (html.byteLength > MAX_HTML_BYTES) {
    return asHtml(request, page, html);
  }

  // oxlint-disable-next-line eslint/one-var -- converts only within the size cap
  const conversion = await convert(ai, html, request);
  if (!conversion) {
    return asHtml(request, page, html);
  }

  // oxlint-disable-next-line eslint/one-var -- built from the successful conversion
  const response = withPageCaching(
    markdownResponse(conversion, page, validator),
    page
  );
  await store(response, key, options);
  return forMethod(request, response);
}
