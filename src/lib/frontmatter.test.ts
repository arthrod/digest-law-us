/**
 * Broken-frontmatter tolerance. The corpus is machine-written and a few
 * documents carry frontmatter that is not loadable YAML; one of them must not
 * end a ~57k-page build, and it must not silently cost a source page the
 * `resource:` link that makes it provenance.
 *
 * Two properties carry the weight. Agreement: the loader records chunk spans
 * and a content hash over the body returned here and the page renderer slices
 * that same body later, so both must recover the same string for the same
 * bytes — and, on well-formed files, exactly the body gray-matter produces.
 * Salvage: the fields a source page is built from survive one bad line.
 *
 * The three broken shapes below are verbatim from the corpus (nine files,
 * August 2026), not invented.
 */
import { describe, expect, test } from "bun:test";

import { parseFrontmatter, parseFrontmatterLoose } from "./frontmatter";

/** A flow sequence whose entries were never comma-separated. */
const missingCommas = `---
type: "source"
title: "N.Y. Insurance Law § 3203"
resource: "https://www.nysenate.gov/legislation/laws/ISC/3203"
tags: ["entire contract" "life insurance" "incontestability"]
timestamp: "2026-08-04T00:52:00+00:00"
---

body text
`,
  /** A search query with unescaped inner quotes, inside a flow sequence. */
  quotedQuery = `---
type: "source"
title: "240.14a-16.md"
description: "17 CFR § 240.14a-16 - Internet availability of proxy materials."
resource: "https://www.law.cornell.edu/cfr/text/17/240.14a-16"
tags: [""17 CFR 240.14a-16" notice and access site:law.cornell.edu"]
timestamp: "2026-08-05T20:25:00+00:00"
---

§ 240.14a-16 Internet availability of proxy materials.
`,
  /** A quoted scalar with prose trailing the closing quote. */
  trailingProse = `---
type: "source"
title: '29 CFR 18.301 — Presumptions in general'
description: '29 CFR 18.301 — Presumptions in general' — official GovInfo XML granule (CFR-2025).
resource: 'https://www.govinfo.gov/app/details/CFR-2025-title29-vol1'
timestamp: "2026-08-05T00:00:00+00:00"
---

body text
`;

describe("parseFrontmatterLoose", () => {
  test("matches gray-matter exactly on well-formed frontmatter", () => {
    for (const raw of [
      '---\ntitle: "A"\n---\n\nbody\n',
      "---\ntitle: A\n---\nbody with no blank line\n",
      "no frontmatter at all\n---\nnot a delimiter\n",
      "---\ntitle: A\n---\r\ncrlf body\n",
      "",
    ]) {
      const loose = parseFrontmatterLoose(raw);
      expect(loose.error).toBeUndefined();
      expect(loose.content).toBe(parseFrontmatter(raw).content);
    }
  });

  test("every corpus defect is unloadable YAML to begin with", () => {
    for (const raw of [quotedQuery, trailingProse, missingCommas]) {
      expect(() => parseFrontmatter(raw)).toThrow();
      expect(parseFrontmatterLoose(raw).error).toBeDefined();
    }
  });

  test("recovers the body byte-for-byte as gray-matter would", () => {
    const { content } = parseFrontmatterLoose(quotedQuery),
      // The same file with only the offending line repaired.
      fixed = quotedQuery.replace(/^tags: .*$/mu, "tags: []");
    expect(content).toBe(parseFrontmatter(fixed).content);
    // One newline after the closing delimiter belongs to it; the blank
    // line of the document survives, exactly as gray-matter leaves it.
    expect(content).toBe(
      "\n§ 240.14a-16 Internet availability of proxy materials.\n"
    );
  });

  test("recovers the same body every time — spans stay valid", () => {
    // The loader indexes spans into this string; the renderer slices it.
    const first = parseFrontmatterLoose(quotedQuery).content,
      second = parseFrontmatterLoose(quotedQuery).content;
    expect(second).toBe(first);
    expect(quotedQuery.endsWith(first)).toBe(true);
  });

  test("salvages the provenance fields past an unescaped quote", () => {
    const { data } = parseFrontmatterLoose(quotedQuery);
    expect(data.title).toBe("240.14a-16.md");
    expect(data.resource).toBe(
      "https://www.law.cornell.edu/cfr/text/17/240.14a-16"
    );
    expect(data.description).toBe(
      "17 CFR § 240.14a-16 - Internet availability of proxy materials."
    );
    expect(data.timestamp).toBe("2026-08-05T20:25:00+00:00");
    // The malformed line itself stays lost rather than being guessed at.
    expect(data.tags).toBeUndefined();
  });

  test("salvages past prose trailing a quoted scalar", () => {
    const { data } = parseFrontmatterLoose(trailingProse);
    expect(data.title).toBe("29 CFR 18.301 — Presumptions in general");
    expect(data.resource).toBe(
      "https://www.govinfo.gov/app/details/CFR-2025-title29-vol1"
    );
    // Unbalanced quotes are kept verbatim — the line is not YAML to reinterpret.
    expect(data.description).toBe(
      "'29 CFR 18.301 — Presumptions in general' — official GovInfo XML granule (CFR-2025)."
    );
  });

  test("salvages past a comma-less flow sequence", () => {
    const { data } = parseFrontmatterLoose(missingCommas);
    expect(data.title).toBe("N.Y. Insurance Law § 3203");
    expect(data.resource).toBe(
      "https://www.nysenate.gov/legislation/laws/ISC/3203"
    );
    expect(data.tags).toBeUndefined();
  });

  test("salvage never overwrites a real field with a later line", () => {
    const raw = [
      "---",
      'title: "Real"',
      'tags: ["broken" "line"]',
      "title: Not the title, a continuation line of some value",
      "---",
      "",
      "body",
      "",
    ].join("\n");
    expect(parseFrontmatterLoose(raw).data.title).toBe("Real");
  });

  test("an unterminated block is all frontmatter, as gray-matter has it", () => {
    const raw = "---\ntitle: [unclosed\nstill frontmatter\n";
    expect(parseFrontmatterLoose(raw).content).toBe("");
  });
});
