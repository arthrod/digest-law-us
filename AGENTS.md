# AGENTS.md

Guidance for AI agents working in `digest-law-us` — the Astro site that renders
the American Legal Digest corpus and deploys it to Cloudflare Workers at
https://digest.law. Read this before building or deploying.

## The build OOMs without a 12 GB Node heap

The site statically renders **~20,900 pages (29,667 files, ~1.8 GB dist/)** in a
single `astro build`. With Node's default heap this dies roughly 20 minutes in:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

(usually aborting inside a `node:fs` read / `StringDecoder` frame while loading
corpus sources — the crash site is a symptom, not the cause).

The fix is baked into `package.json`: the `build` script starts with
`NODE_OPTIONS=--max-old-space-size=24576` (dev/preview/sync likewise) and the
`deploy` script with `NODE_OPTIONS=--max-old-space-size=12288`. Rules:

1. **Always build via `npm run build` / `npm run deploy`** — never invoke a raw
   `astro build`, and never remove or "simplify away" the `NODE_OPTIONS` prefix
   from those scripts. If you add a new script that runs `astro build`, it needs
   the same prefix.
2. A full build takes **~27 minutes**. That is normal; do not kill it for being
   slow.

## Don't let a pipe eat the build's exit code

The OOM above once went unnoticed because the build was launched as
`npm run deploy 2>&1 | tail -40` — the pipeline reports **tail's** exit 0, so
the fatal abort looked like success. Run builds with no pipe (redirect to a file
if you need the log) and verify success from the output, not the exit code alone.

## Grepping build logs: "error" is a legal topic name

Corpus URLs legitimately contain the word *error* (`appeal-and-error`,
`diagnostic-error`, …). To check a build log, match
`\[build\] Complete!|Stack trace|\[ERROR\]` — never bare `error`.

## Every number on the site is derived at build time. Do not type one in.

The site's whole claim is that you can check it, so a figure written into a
page is a bug even when it is currently correct — it survives the corpus
changing underneath it. There are two derivation paths, and everything
published goes through one of them:

| Figure | Source | Read via |
| --- | --- | --- |
| digests, areas, sources, bytes, pre-provenance, latest timestamp | the content collections (`CORPUS_DIR`) | `getCorpus()` → `corpus.stats`, `src/lib/corpus.ts` |
| bundles deleted at the evidence floor, purge dates | `PURGE_DIR/YYYY-MM-DD-purge-*.tsv`, one row per deleted bundle | `getPurge()`, `src/lib/purge.ts` |

`PURGE_DIR` defaults to `../key-digest-runner/docs` — the same repo as the
corpus, one level above `key_digest/`. A new purge needs no code change:
drop the manifest in that directory and the next build picks it up, adds it
to the total, and re-dates the pull quote on `/methodology/#the-floor`.

**When a source is missing, the claim disappears — it does not fall back to a
number.** `getPurge()` returns an empty summary and warns to the build log;
`/about/` and `/methodology/` then render without their purge tile and without
the purge sentence, and the methodology pull quote swaps to a version that
makes no count. This is deliberate. Both stat grids are built from a `tiles`
array with a `tileClass(i)` helper precisely so a tile can vanish without the
borders going wrong — add tiles there, not as fresh markup.

## The Worker is load-bearing now — `assets`-only deploys are gone

`wrangler.jsonc` used to be an assets-only config. It now has `main:
"worker/index.ts"`, because `/contact/` needs somewhere to POST. Three things
about that are easy to break:

1. **`assets.run_worker_first: ["/api/*"]` is required.** With
   `not_found_handling: "404-page"` and no `run_worker_first`, a POST to
   `/api/contact` is answered with the 404 page and the Worker never runs. The
   symptom is a form that "silently fails" with a 200.
2. **The Worker must fall through.** Anything that is not `/api/contact` is
   returned by `env.ASSETS.fetch(request)`. Do not add routing cleverness
   there; the 20,900 static pages are the product.
3. **Recipients never come from the request.** `worker/index.ts` maps a topic
   id to a recipient list from `src/lib/committee.ts`, and
   `allowed_destination_addresses` in `wrangler.jsonc` closes the set again at
   the platform level. Keep both. A form endpoint that mails an
   attacker-supplied address is an open relay with extra steps.

### One-time setup before the first deploy

```bash
npx wrangler email sending enable digest.law
npx wrangler email sending dns get digest.law   # confirm SPF + DKIM landed
```

`forms@digest.law` is the envelope sender; `arthur@digest.law` and
`carolina@digest.law` are the only permitted recipients. To send real mail
from `wrangler dev`, add `"remote": true` to the `send_email` binding — and
take it out again before deploying.

Abuse controls today are a honeypot field, an `Origin` check, length caps, and
the closed recipient set. There is **no rate limit**: the worst case is spam
into the committee's own inboxes, not an open relay. If that becomes a
problem, Turnstile or a rate-limit binding is the next step, not more
validation.

## Committee and contact data lives in one module

`src/lib/committee.ts` holds the reviewers, the contact topics, and the field
limits. It is imported by `/committee/`, `/contact/`, **and the Worker**, so
the `<select>` on the page and the routing table that turns a topic into
recipients cannot drift apart. Keep it free of Astro and Node imports — the
Worker bundle pulls it in directly.

Changing who reviews, or where a topic routes, is an edit to that file plus
`allowed_destination_addresses` in `wrangler.jsonc`. Nothing else.

## `.prettierignore` is an allowlist — new top-level directories are invisible

It opens with `/*` (ignore everything) and then re-includes `!/src`,
`!/public`, and a handful of files. The formatter honours it, so **any new
top-level directory is silently skipped by `oxfmt` until you add a `!` line
for it** — `worker/` was, until `!/worker` was added. `oxlint` does not read
this file, so the symptom is confusing: the directory lints but never
formats. If you add a top-level source directory, add it here too.

## The toolchain is oxlint + oxfmt. Biome is gone — do not bring it back.

`ultracite` v7 is an oxlint/oxfmt tool: its peer dependencies are
`oxlint@^1` and `oxfmt`, and it resolves against `typescript@7.0.2`. The repo
was previously stuck half-migrated — a leftover `biome.jsonc` extending
`ultracite/biome/core`, which asks for Biome rules (`useSortedEnumMembers`,
`useSortedTypeFields`, `useSortedPackageJson`, …) that the pinned
`@biomejs/biome@2.5.3` does not know. Result: `ultracite check` and
`ultracite fix` aborted on **every** file with *"Biome exited because the
configuration resulted in errors."*

Resolved by finishing the migration, not by pinning a newer Biome — Biome was
the component holding the toolchain back from TypeScript 7:

- `biome.jsonc` deleted, `@biomejs/biome` removed from devDependencies.
- **`.oxlintrc.json` is the config ultracite actually reads.** It was missing;
  only the orphaned `.oxlintrc.ultracite-*.json` copies existed, so bare
  `oxlint` was silently running near-default rules. It now `extends` those two
  and adds the repo's override layer.
- `format` / `format:check` called `prettier`, which is not a direct
  dependency. They call `oxfmt` now.

`ultracite check` is green (0 errors, ~28 warnings, 437 rules).

### The override layer is not laziness — read before deleting a line from it

Ultracite's core preset assumes a plain app. Several of its rules are
structurally wrong here and were turned **off** with cause:

| Rule | Why off |
| --- | --- |
| `node/no-top-level-await` | Astro frontmatter *is* top-level await (`await getCorpus()`). |
| `import/no-nodejs-modules` | The corpus loaders read the filesystem at build time. That is the architecture. |
| `unicorn/filename-case` | Astro components are PascalCase by framework convention. |
| `jest/require-hook`, `vitest/require-hook` | Fire on `.astro` files; there is no test suite. |
| `eslint/no-implicit-globals` | Fires on `<script>` blocks, which Astro scopes as modules. |
| `eslint/func-style` | 57 hits; the repo consistently uses function declarations. |
| `import/no-relative-parent-imports` | The Worker deliberately imports `../src/lib/committee`. |

`max-statements`, `complexity`, `max-nested-calls` and the `promise/*`
preferences are **warnings**, not off — they are real signal on
`src/lib/skos.ts` and `src/lib/corpus.ts`, just not worth failing a build over
today. Turning any of them back to `error` means refactoring those two files
first.

## The favicon is generated, not drawn

`public/favicon.svg` is "digest", underlined, on Michigan blue — the footer
wordmark at icon scale. `scripts/make-favicon.py` outlines the word from
`public/fonts/eliza.woff2` and inlines it as a path, because a favicon is
rasterised before any CSS runs and can never wait on a webfont. Edit the
script, not the SVG.

The glyphs carry a 5-unit white stroke. That is load-bearing: eliza's thin
strokes disappear when the 512px master is downsampled to a 16-24px tab
icon. Past ~7 the counters in "e" and "g" fill in and the word becomes a bar.
**Check any change at 16/24/32 px** — the whole design constraint is invisible
at full size.

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `pnpm dlx ultracite fix` before committing to ensure compliance.


# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.
