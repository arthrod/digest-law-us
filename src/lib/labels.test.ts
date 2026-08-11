/**
 * formatBytes tiers. The GB tier exists because the corpus crossed it: the
 * About page was publishing "5616.9 MB" for the retained-source total.
 */
import { describe, expect, test } from "bun:test";

import { formatBytes } from "./labels";

describe("formatBytes", () => {
  test("bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
  });

  test("kilobytes round to whole", () => {
    expect(formatBytes(1000)).toBe("1 KB");
    expect(formatBytes(188_400)).toBe("188 KB");
  });

  test("megabytes keep one decimal", () => {
    expect(formatBytes(1_000_000)).toBe("1.0 MB");
    expect(formatBytes(12_500_000)).toBe("12.5 MB");
    expect(formatBytes(999_949_999)).toBe("999.9 MB");
  });

  test("gigabytes keep one decimal", () => {
    expect(formatBytes(1_000_000_000)).toBe("1.0 GB");
    expect(formatBytes(5_628_718_105)).toBe("5.6 GB");
  });
});
