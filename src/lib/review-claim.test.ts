/**
 * No page may say a person reviews the digests: the merge gate is an automated
 * reviewing agent and no digest has been reviewed by a person (publicize plan 05, step 1).
 */
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const FALSE =
    /performed by people|gated by review|review-gated|the digest records it|Who gates the merge/iu,
  FILES = [
    "PRODUCT.md",
    "README.md",
    "src/components/ProvenanceStrip.astro",
    "src/config.ts",
    "src/pages/about.astro",
    "src/pages/committee.astro",
    "src/pages/contact.astro",
    "src/pages/index.astro",
    "src/pages/methodology.astro",
  ];

describe("human-review claim", () => {
  test.each(FILES)("%s does not claim human review", async (file) => {
    expect(await readFile(file, "utf8")).not.toMatch(FALSE);
  });

  test("methodology names the automated gate", async () => {
    expect(await readFile("src/pages/methodology.astro", "utf8")).toContain(
      "automated reviewing agent"
    );
  });
});
