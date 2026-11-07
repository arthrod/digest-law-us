import { describe, expect, test } from "bun:test";

import {
  duplicateDescriptions,
  evenSample,
  headProblems,
  headTags,
  jsonLdBlocks,
  pageKind,
  problemCounts,
} from "./head-check";
import {
  ARTICLE,
  CRUMBS,
  DIGEST_HEAD,
  html,
  HOME_HEAD,
  ld,
  PAGE_HEAD,
  SITE,
  WEBSITE,
} from "./head-check.fixtures";

function digestPage(
  change: (head: string[]) => string[] = (head) => head,
  body: string[] = [ld(CRUMBS)]
): string {
  return html(change([...DIGEST_HEAD]), body);
}

function without(fragment: string) {
  return (head: string[]) => head.filter((tag) => !tag.includes(fragment));
}

function replacing(fragment: string, tag: string) {
  return (head: string[]) =>
    head.map((current) => (current.includes(fragment) ? tag : current));
}

describe("headTags", () => {
  test("reads link, meta and script attributes in any order, decoded", () => {
    const tags = headTags(
      html([
        '<meta property="og:title" content="A &amp; B &quot;C&quot;">',
        '<link rel="canonical" href="https://digest.law/x/">',
        '<script defer src="/webmcp.js"></script>',
      ])
    );
    expect(tags).toEqual([
      { attrs: { content: 'A & B "C"', property: "og:title" }, name: "meta" },
      {
        attrs: { href: "https://digest.law/x/", rel: "canonical" },
        name: "link",
      },
      { attrs: { defer: "", src: "/webmcp.js" }, name: "script" },
    ]);
  });

  test("ignores tags in the body", () => {
    const tags = headTags(html([], ['<meta content="x" name="description">']));
    expect(tags).toEqual([]);
  });
});

describe("jsonLdBlocks", () => {
  test("parses every JSON-LD block, head and body", () => {
    expect(jsonLdBlocks(digestPage())).toEqual([ARTICLE, CRUMBS]);
  });

  test("a block that does not parse is reported as an Error", () => {
    const [block] = jsonLdBlocks(
      html(['<script type="application/ld+json">{nope</script>'])
    );
    expect(block).toBeInstanceOf(Error);
  });
});

describe("pageKind", () => {
  test.each([
    ["the home page", "/", html(PAGE_HEAD), "home"],
    ["a page with an Article", "/evidence-law/x/", digestPage(), "digest"],
    ["any other page", "/about/", html(PAGE_HEAD), "page"],
  ])("%s", (_label, path, page, kind) => {
    expect(pageKind(path, page)).toBe(kind);
  });
});

describe("headProblems: pages that pass", () => {
  test.each([
    ["a digest page", digestPage(), "digest"],
    ["the home page", html(HOME_HEAD), "home"],
    ["any other page", html(PAGE_HEAD), "page"],
  ] as const)("%s has no problems", (_label, page, kind) => {
    expect(headProblems(page, kind)).toEqual([]);
  });
});

describe("headProblems: every page", () => {
  test.each([
    ["no canonical", without('rel="canonical"'), "canonical:"],
    ["no description", without('name="description"'), "description:"],
    [
      "an empty description",
      replacing('name="description"', '<meta content="" name="description">'),
      "description:",
    ],
    ["no og:locale", without("og:locale"), "og:locale:"],
    ["no og:image:width", without("og:image:width"), "og:image:width:"],
    ["no og:image:height", without("og:image:height"), "og:image:height:"],
    ["no og:image:alt", without("og:image:alt"), "og:image:alt:"],
    ["no feed link", without("application/rss+xml"), "feed link:"],
    ["no WebMCP script", without("webmcp.js"), "webmcp:"],
    [
      "two canonicals",
      (head: string[]) => [
        ...head,
        `<link href="${SITE}other/" rel="canonical">`,
      ],
      "canonical:",
    ],
    [
      "a JSON-LD block that does not parse",
      (head: string[]) => [
        ...head,
        '<script type="application/ld+json">{nope</script>',
      ],
      "json-ld:",
    ],
  ])("%s", (_label, change, problem) => {
    expect(headProblems(digestPage(change), "digest").join("\n")).toContain(
      problem
    );
  });
});

describe("headProblems: digest pages", () => {
  test.each([
    [
      "og:type website",
      replacing("og:type", '<meta content="website" property="og:type">'),
      "og:type:",
    ],
    [
      "no modified time",
      without("article:modified_time"),
      "article:modified_time:",
    ],
    ["no section", without("article:section"), "article:section:"],
    [
      "the boilerplate description",
      replacing(
        'name="description"',
        '<meta content="Derived from retained sources of the research run." name="description">'
      ),
      "description: boilerplate",
    ],
    ["no Article", without("application/ld+json"), "article:"],
  ])("%s", (_label, change, problem) => {
    expect(headProblems(digestPage(change), "digest").join("\n")).toContain(
      problem
    );
  });

  test.each(["license", "publisher", "inLanguage"])(
    "an Article without %s",
    (field) => {
      const { [field as keyof typeof ARTICLE]: _dropped, ...rest } = ARTICLE,
        page = digestPage(replacing("application/ld+json", ld(rest)));
      expect(headProblems(page, "digest").join("\n")).toContain(
        `article: no ${field}`
      );
    }
  );

  test("no BreadcrumbList", () => {
    expect(
      headProblems(digestPage(undefined, []), "digest").join("\n")
    ).toContain("breadcrumbs:");
  });

  test.each([
    [
      "positions out of order",
      [1, 3, 2],
      [`${SITE}`, `${SITE}a/`, undefined],
      "breadcrumbs: positions",
    ],
    [
      "a crumb before the last without a URL",
      [1, 2, 3],
      [`${SITE}`, undefined, undefined],
      "breadcrumbs: item 2",
    ],
    [
      "a relative crumb URL",
      [1, 2, 3],
      ["/", `${SITE}a/`, undefined],
      "breadcrumbs: item 1",
    ],
  ])("breadcrumbs with %s", (_label, positions, items, problem) => {
    const list = {
      ...CRUMBS,
      itemListElement: positions.map((position, index) => ({
        "@type": "ListItem",
        item: items[index],
        name: `Crumb ${index}`,
        position,
      })),
    };
    expect(
      headProblems(digestPage(undefined, [ld(list)]), "digest").join("\n")
    ).toContain(problem);
  });
});

describe("headProblems: the home page", () => {
  test.each([
    ["no WebSite", without('"WebSite"'), "website:"],
    ["no Organization", without('"Organization"'), "organization:"],
  ])("%s", (_label, change, problem) => {
    expect(
      headProblems(html(change([...HOME_HEAD])), "home").join("\n")
    ).toContain(problem);
  });

  test("a WebSite without a search action", () => {
    const { potentialAction: _dropped, ...bare } = WEBSITE,
      page = html(replacing('"WebSite"', ld(bare))([...HOME_HEAD]));
    expect(headProblems(page, "home").join("\n")).toContain(
      "website: no SearchAction"
    );
  });
});

describe("duplicateDescriptions", () => {
  test("names each description used by more than one page", () => {
    expect(
      duplicateDescriptions([
        { description: "Shared.", path: "/a/" },
        { description: "Own.", path: "/b/" },
        { description: "Shared.", path: "/c/" },
      ])
    ).toEqual(['"Shared." on 2 pages: /a/, /c/']);
  });

  test("no duplicates, no findings", () => {
    expect(
      duplicateDescriptions([
        { description: "One.", path: "/a/" },
        { description: "Two.", path: "/b/" },
      ])
    ).toEqual([]);
  });
});

describe("evenSample", () => {
  test("spreads the sample evenly over the sorted list", () => {
    const paths = Array.from({ length: 10 }, (_, index) => `/p${index}/`);
    expect(evenSample(paths, 3)).toEqual(["/p0/", "/p3/", "/p6/"]);
  });

  test("a sample as large as the list is the whole list", () => {
    expect(evenSample(["/b/", "/a/"], 5)).toEqual(["/a/", "/b/"]);
  });

  test("always includes the home page", () => {
    expect(evenSample(["/z/", "/y/", "/", "/x/"], 1)).toEqual(["/"]);
    expect(evenSample(["/b/", "/a/", "/c/", "/"], 2)).toContain("/");
  });
});

describe("problemCounts", () => {
  test("counts pages per check, worst first", () => {
    expect(
      problemCounts([
        ["canonical: expected 1, found 0", "og:locale: expected one"],
        ["og:locale: expected one"],
        [],
      ])
    ).toEqual([
      ["og:locale", 2],
      ["canonical", 1],
    ]);
  });
});
