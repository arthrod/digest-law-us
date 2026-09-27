#!/usr/bin/env node
/**
 * Re-apply the local fix to Astro's chunked content-store writer.
 *
 * Astro's `getChunkEnd()` (astro/dist/content/data-store-writer.js) calls
 * `TextEncoder.encode()` on a one-or-two character slice for *every character*
 * of the serialized store just to learn that character's UTF-8 byte length. The
 * store is rewritten on a 500 ms debounce after every `store.set()`, so a large
 * content collection spends its entire sync re-chunking itself instead of
 * reading files. Measured on this corpus: ~1.5 s per MB written, which at a
 * 1.5 GB store is ~38 minutes per write, and the writes run back to back.
 *
 * The fix derives the byte length arithmetically from the code point. Measured
 * 63-74x faster across 10k-100k entries, and byte-identical: the same xxhash
 * chunk names at chunk sizes 64/257/4096/65536 over 38k+ boundaries with emoji,
 * CJK, accents and astral-plane characters.
 *
 * Why a postinstall script instead of `pnpm patch`: `patchedDependencies`
 * rewrites pnpm-lock.yaml, and Astro's incremental-build cache key includes
 * `lockfileHash` -- a sha256 over the raw bytes of the lockfiles and nothing
 * else (see astro/dist/core/build/lockfile/hasher.js). Touching the lockfile
 * would invalidate the incremental manifest and force a full cold re-render of
 * every route, which on this corpus is more than a day of work. package.json is
 * never part of that hash, so a script hook here is free.
 *
 * Usage:
 *   node scripts/patch-astro-store-writer.mjs           apply (idempotent)
 *   node scripts/patch-astro-store-writer.mjs --check    verify only, exit 1 if unpatched
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "node_modules/astro/dist/content/data-store-writer.js");
const MARKER = "PATCHED (local): derive the UTF-8 byte length";
const BUGGY = "const charBytes = ENCODER.encode(str.slice(index, index + charLength)).length;";
const FIXED = `// ${MARKER} from the code
    // point instead of allocating a TextEncoder result per character. See
    // scripts/patch-astro-store-writer.mjs for the measurements.
    const charBytes = codePoint < 128 ? 1 : codePoint < 2048 ? 2 : codePoint < 65536 ? 3 : 4;`;

const checkOnly = process.argv.includes("--check");
const say = (msg) => console.log(`[patch-astro-store-writer] ${msg}`);

let real;
try {
  real = fs.realpathSync(TARGET);
} catch {
  say("astro not installed yet; nothing to do");
  process.exit(0);
}

const source = fs.readFileSync(real, "utf8");

if (source.includes(MARKER)) {
  say("already patched");
  process.exit(0);
}

if (!source.includes(BUGGY)) {
  say("WARNING: astro's getChunkEnd no longer matches the known-slow shape.");
  say("Either upstream fixed it (good, drop this script) or the code moved.");
  say("Verify content-sync duration before trusting a long build.");
  // As a postinstall hook this must not break installs; as the build gate
  // (--check) it must stop a multi-day build that may have lost the fix.
  // Once upstream is verified fixed, drop the --check from package.json.
  process.exit(checkOnly ? 1 : 0);
}

if (checkOnly) {
  say("UNPATCHED. Content sync will be roughly 25x slower than it needs to be.");
  say("Run: node scripts/patch-astro-store-writer.mjs");
  process.exit(1);
}

// Rename a fresh file over the target rather than writing in place: pnpm
// hardlinks package files into its global content-addressable store, so an
// in-place write corrupts astro for every project on the machine.
const patched = source.replace(BUGGY, FIXED);
const tmp = `${real}.patch-tmp-${process.pid}`;
fs.writeFileSync(tmp, patched);
fs.renameSync(tmp, real);
say(`patched ${path.relative(ROOT, TARGET)}`);
