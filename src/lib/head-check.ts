/**
 * Checks on the <head> of built pages: what search engines, social cards,
 * feed readers and browser agents read. scripts/check-head.ts runs them over
 * a sample of a built dist; this module is the pure part, so each check is
 * tested on fixture HTML. Astro writes attributes in double quotes, which is
 * all the tag reader below handles.
 */

/** The home page, a digest page (it carries an Article), or any other page. */
export type PageKind = "digest" | "home" | "page";

export interface HeadTag {
  attrs: Record<string, string>;
  name: "link" | "meta" | "script";
}

type Json = Record<string, unknown>;

const ATTRIBUTE = /(?<key>[\w:.-]+)(?:="(?<value>[^"]*)")?/gu,
  BOILERPLATE = [
    "Derived from retained sources of the research run.",
    "Provisional synthesis",
  ],
  ENTITIES: Record<string, string> = {
    "&#39;": "'",
    "&amp;": "&",
    "&gt;": ">",
    "&lt;": "<",
    "&quot;": '"',
  },
  HEAD = /<head[^>]*>(?<head>[\s\S]*?)<\/head>/iu,
  JSON_LD =
    /<script\b[^>]*type="application\/ld\+json"[^>]*>(?<json>[\s\S]*?)<\/script>/giu,
  // A quoted value may hold a raw ">": Astro escapes only & and " in
  // attributes.
  TAG = /<(?<name>link|meta|script)\b(?<attrs>(?:[^>"]|"[^"]*")*)>/giu;

function decode(value: string): string {
  return value.replaceAll(
    /&(?:#39|amp|gt|lt|quot);/gu,
    (entity) => ENTITIES[entity] ?? entity
  );
}

/** The link, meta and script tags of the document's <head>. */
export function headTags(html: string): HeadTag[] {
  const head = html.match(HEAD)?.groups?.head ?? "",
    tags: HeadTag[] = [];
  for (const match of head.matchAll(TAG)) {
    const attrs: Record<string, string> = {};
    for (const attr of (match.groups?.attrs ?? "").matchAll(ATTRIBUTE)) {
      const { key = "", value = "" } = attr.groups ?? {};
      attrs[key] = decode(value);
    }
    tags.push({
      attrs,
      name: (match.groups?.name ?? "meta").toLowerCase() as HeadTag["name"],
    });
  }
  return tags;
}

/** Every JSON-LD block in the document; one that does not parse is an Error. */
export function jsonLdBlocks(html: string): unknown[] {
  return [...html.matchAll(JSON_LD)].map((match) => {
    try {
      return JSON.parse(match.groups?.json ?? "") as unknown;
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  });
}

function typed(blocks: unknown[], type: string): Json[] {
  return blocks.filter(
    (block): block is Json =>
      typeof block === "object" &&
      block !== null &&
      !(block instanceof Error) &&
      (block as Json)["@type"] === type
  );
}

export function pageKind(path: string, html: string): PageKind {
  if (path === "/") {
    return "home";
  }
  return typed(jsonLdBlocks(html), "Article").length > 0 ? "digest" : "page";
}

/** Values of the meta tags whose name or property is `key`. */
function metaValues(tags: HeadTag[], key: string): string[] {
  return tags
    .filter(
      (tag) =>
        tag.name === "meta" &&
        (tag.attrs.property === key || tag.attrs.name === key)
    )
    .map((tag) => tag.attrs.content ?? "");
}

function expectMeta(
  tags: HeadTag[],
  key: string,
  wanted?: string
): string | null {
  const values = metaValues(tags, key);
  if (values.length !== 1 || !values[0]) {
    return `${key}: expected one non-empty value, found ${values.length}`;
  }
  return wanted && values[0] !== wanted
    ? `${key}: expected "${wanted}", found "${values[0]}"`
    : null;
}

function everyPage(tags: HeadTag[], blocks: unknown[]): (string | null)[] {
  const canonicals = tags.filter(
      (tag) => tag.name === "link" && tag.attrs.rel === "canonical"
    ),
    feed = tags.some(
      (tag) =>
        tag.name === "link" &&
        tag.attrs.rel === "alternate" &&
        tag.attrs.type === "application/rss+xml" &&
        (tag.attrs.href ?? "").endsWith("/rss.xml")
    ),
    webmcp = tags.some(
      (tag) => tag.name === "script" && tag.attrs.src === "/webmcp.js"
    );
  return [
    canonicals.length === 1
      ? null
      : `canonical: expected 1, found ${canonicals.length}`,
    expectMeta(tags, "description"),
    expectMeta(tags, "og:locale", "en_US"),
    expectMeta(tags, "og:image:width", "1200"),
    expectMeta(tags, "og:image:height", "630"),
    expectMeta(tags, "og:image:alt"),
    feed ? null : "feed link: no <link rel=alternate> to /rss.xml",
    webmcp ? null : "webmcp: no <script src=/webmcp.js>",
    ...blocks
      .filter((block) => block instanceof Error)
      .map((error) => `json-ld: does not parse (${String(error)})`),
  ];
}

function breadcrumbProblems(blocks: unknown[]): string[] {
  const [list] = typed(blocks, "BreadcrumbList");
  if (!list) {
    return ["breadcrumbs: no BreadcrumbList"];
  }
  // oxlint-disable-next-line eslint/one-var -- read only once the list exists
  const items = (list.itemListElement ?? []) as Json[],
    problems: string[] = [];
  if (items.some((item, index) => item.position !== index + 1)) {
    problems.push("breadcrumbs: positions are not 1..n in order");
  }
  for (const [index, item] of items.slice(0, -1).entries()) {
    if (!String(item.item ?? "").startsWith("https://")) {
      problems.push(`breadcrumbs: item ${index + 1} has no absolute URL`);
    }
  }
  return problems;
}

function digestProblems(tags: HeadTag[], blocks: unknown[]): string[] {
  const [article] = typed(blocks, "Article"),
    [description = ""] = metaValues(tags, "description"),
    problems = [
      expectMeta(tags, "og:type", "article"),
      expectMeta(tags, "article:modified_time"),
      expectMeta(tags, "article:section"),
      BOILERPLATE.some((text) => description.startsWith(text))
        ? `description: boilerplate "${description}"`
        : null,
    ].filter((problem): problem is string => problem !== null);
  if (article) {
    for (const field of ["license", "publisher", "inLanguage"]) {
      if (!article[field]) {
        problems.push(`article: no ${field}`);
      }
    }
  } else {
    problems.push("article: no Article JSON-LD");
  }
  return [...problems, ...breadcrumbProblems(blocks)];
}

function homeProblems(blocks: unknown[]): string[] {
  const [website] = typed(blocks, "WebSite"),
    problems: string[] = [];
  if (!website) {
    problems.push("website: no WebSite JSON-LD");
  } else if (
    (website.potentialAction as Json | undefined)?.["@type"] !== "SearchAction"
  ) {
    problems.push("website: no SearchAction");
  }
  if (typed(blocks, "Organization").length === 0) {
    problems.push("organization: no Organization JSON-LD");
  }
  return problems;
}

/** Everything wrong with one built page's head; empty when it passes. */
export function headProblems(html: string, kind: PageKind): string[] {
  const blocks = jsonLdBlocks(html),
    tags = headTags(html),
    // oxlint-disable-next-line eslint/sort-vars -- problems read tags and blocks (TDZ)
    problems = everyPage(tags, blocks).filter(
      (problem): problem is string => problem !== null
    );
  if (kind === "digest") {
    problems.push(...digestProblems(tags, blocks));
  }
  if (kind === "home") {
    problems.push(...homeProblems(blocks));
  }
  return problems;
}

/** Each description that more than one page uses, with the pages. */
export function duplicateDescriptions(
  pages: { description: string; path: string }[]
): string[] {
  const byDescription = new Map<string, string[]>();
  for (const { description, path } of pages) {
    byDescription.set(description, [
      ...(byDescription.get(description) ?? []),
      path,
    ]);
  }
  return [...byDescription]
    .filter(([, paths]) => paths.length > 1)
    .map(
      ([description, paths]) =>
        `"${description}" on ${paths.length} pages: ${paths.join(", ")}`
    );
}

/**
 * `size` paths spread evenly over the sorted list, always with the home
 * page: a deterministic sample, so two runs on one dist read the same pages.
 */
export function evenSample(paths: string[], size: number): string[] {
  const sorted = paths.toSorted();
  if (size >= sorted.length) {
    return sorted;
  }
  /* oxlint-disable eslint/one-var, eslint/sort-vars -- each value reads the one before it (TDZ) */
  const hasHome = sorted.includes("/"),
    rest = sorted.filter((path) => path !== "/"),
    wanted = size - (hasHome ? 1 : 0),
    step = rest.length / Math.max(wanted, 1),
    picked = Array.from(
      { length: wanted },
      (_, index) => rest[Math.floor(index * step)] ?? ""
    );
  /* oxlint-enable eslint/one-var, eslint/sort-vars */
  return hasHome ? ["/", ...picked] : picked;
}

/** Pages failing each check (the text before the first ": "), worst first. */
export function problemCounts(pages: string[][]): [string, number][] {
  const counts = new Map<string, number>();
  for (const problems of pages) {
    for (const check of new Set(
      problems.map((problem) => problem.split(": ")[0] ?? problem)
    )) {
      counts.set(check, (counts.get(check) ?? 0) + 1);
    }
  }
  return [...counts].toSorted(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
}
