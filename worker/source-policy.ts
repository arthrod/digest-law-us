/**
 * Retained-source pages (`…/sources/<slug>/`) reproduce third-party text.
 * Two rules, applied in the Worker so they cover every shard without a
 * rebuild:
 *
 * 1. None of them is indexed: `X-Robots-Tag: noindex, noarchive`.
 * 2. Full texts of copyrighted scholarship (law reviews, SSRN) are withheld:
 *    451 with a link to the origin. The origin is read from the page's own
 *    "Origin:" link, so no path list has to be kept in step with the corpus.
 *
 * Which other hosts have a stated basis for full text is an editorial
 * decision (publicize plan 05, D2); until it is made, only these are blocked.
 */

/** Hosts of scholarship published under the author's or journal's copyright. */
const BLOCKED_HOST = /(?:^|\.)ssrn\.com$|law-?review|lawjournal|law-journal/u,
  ORIGIN_LINK = /<a\s[^>]*href="(?<href>https?:\/\/[^"]+)"[^>]*>\s*Origin:/u,
  ROBOTS = "noindex, noarchive",
  SOURCE_PATH = /\/sources\/[^/]+\/?$/u,
  STRIP_CLAIM = "Machine-researched · review-gated",
  STRIP_TRUE =
    "Machine-researched · machine-reviewed · not reviewed by a lawyer";

function isHtmlOk(response: Response): boolean {
  return (
    response.ok &&
    (response.headers.get("content-type") ?? "").includes("text/html")
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The origin URL a source page links to, if any. */
export function originOf(html: string): string | undefined {
  return ORIGIN_LINK.exec(html)?.groups?.href;
}

export function isBlockedOrigin(url: string): boolean {
  try {
    return BLOCKED_HOST.test(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function withheld(origin: string): string {
  const href = escapeHtml(origin);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="${ROBOTS}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Source withheld · digest.law</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5">
<h1>Source withheld</h1>
<p>This retained source is copyrighted scholarship, so digest.law does not republish its text.
Read it at the origin: <a href="${href}" rel="nofollow">${href}</a>.</p>
<p><a href="/">digest.law</a></p>
</body></html>`;
}

/** Apply the source rules to a response; anything else passes through unchanged. */
export async function applySourcePolicy(
  pathname: string,
  response: Response
): Promise<Response> {
  if (!isHtmlOk(response) || !SOURCE_PATH.test(pathname)) {
    return response;
  }
  const body = await response.text(),
    headers = new Headers(response.headers),
    origin = originOf(body);
  if (origin && isBlockedOrigin(origin)) {
    return new Response(withheld(origin), {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": ROBOTS,
      },
      status: 451,
    });
  }
  headers.set("x-robots-tag", ROBOTS);
  headers.delete("content-length");
  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function rewriteReviewClaim(res: Response): Promise<Response> {
  const body = await res.text(),
    headers = new Headers(res.headers);
  if (!body.includes("review-gated")) {
    return new Response(body, {
      headers: res.headers,
      status: res.status,
      statusText: res.statusText,
    });
  }
  headers.delete("content-length");
  // The body differs from the asset the ETag describes.
  headers.delete("etag");
  return new Response(
    body
      .replaceAll(STRIP_CLAIM, STRIP_TRUE)
      .replaceAll("review-gated", "machine-reviewed"),
    {
      headers,
      status: res.status,
      statusText: res.statusText,
    }
  );
}

/**
 * Every rendered page: the source rules above, then the provenance strip's
 * "review-gated" (no person reviews the digests; the merge gate is an agent)
 * rewritten until the next full rebuild ships the corrected component.
 */
export async function applyPagePolicy(
  pathname: string,
  response: Response
): Promise<Response> {
  const res = await applySourcePolicy(pathname, response);
  return isHtmlOk(res) ? await rewriteReviewClaim(res) : res;
}
