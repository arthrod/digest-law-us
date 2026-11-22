import { describe, expect, test } from "bun:test";

import {
  remarkFixHeadingMarkers,
  stripStrayHeadingMarkers,
} from "./remark-fix-heading-markers";

describe("stray heading markers", () => {
  test("a doubled marker is removed from the heading text", () => {
    expect(stripStrayHeadingMarkers("## Checklist of concrete steps")).toBe(
      "Checklist of concrete steps"
    );
    expect(stripStrayHeadingMarkers("## ### Checklist")).toBe("Checklist");
  });

  test("ordinary headings are untouched", () => {
    expect(stripStrayHeadingMarkers("Checklist")).toBe("Checklist");
    expect(stripStrayHeadingMarkers("#1 rule of evidence")).toBe(
      "#1 rule of evidence"
    );
    expect(stripStrayHeadingMarkers("C# and the law")).toBe("C# and the law");
  });

  test("only headings are rewritten", () => {
    const tree = {
      children: [
        {
          children: [{ type: "text", value: "## Checklist" }],
          depth: 2,
          type: "heading",
        },
        {
          children: [{ type: "text", value: "## not a heading" }],
          type: "paragraph",
        },
      ],
      type: "root",
    };
    remarkFixHeadingMarkers()(tree);
    expect(tree.children[0]?.children[0]?.value).toBe("Checklist");
    expect(tree.children[1]?.children[0]?.value).toBe("## not a heading");
  });
});
