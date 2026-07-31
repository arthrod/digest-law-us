#!/usr/bin/env bun
/**
 * Validate a built SKOS release graph against the published shapes.
 *
 *   bun run skos:check                 validate dist/skos.jsonld
 *   bun run skos:check path/to.jsonld  validate a specific file
 *
 * Fails (exit 1) on any violation. Warnings — unminted concepts, redundant
 * exact+close mappings — are printed and do not fail, because they describe
 * work queued rather than a graph that misstates the taxonomy.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateSkosGraph } from "../src/lib/skos-validate";

const target = path.resolve(
  process.argv[2] ?? path.resolve(import.meta.dirname, "../dist/skos.jsonld")
);

let raw: string;
try {
  raw = await readFile(target, "utf8");
} catch {
  process.stderr.write(
    `Cannot read ${target}.\nBuild the site first (\`bun run build\`), or pass a path.\n`
  );
  process.exit(1);
}

const findings = validateSkosGraph(JSON.parse(raw));
const violations = findings.filter((f) => f.severity === "violation");
const warnings = findings.filter((f) => f.severity === "warning");

const show = (label: string, list: typeof findings, limit: number) => {
  for (const finding of list.slice(0, limit)) {
    process.stdout.write(
      `${label} ${finding.constraint}\n  ${finding.node}\n  ${finding.message}\n`
    );
  }
  if (list.length > limit) {
    process.stdout.write(`… and ${list.length - limit} more ${label}\n`);
  }
};

show("WARN", warnings, 20);
show("FAIL", violations, 50);

process.stdout.write(
  `${path.basename(target)}: ${violations.length} violation(s), ` +
    `${warnings.length} warning(s)\n`
);
process.exit(violations.length === 0 ? 0 : 1);
