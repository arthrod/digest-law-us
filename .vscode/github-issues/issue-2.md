---
id: 5037581648
number: 2
title: "CI cannot build: the corpus lives in a private sibling repo"
state: open
created_at: "2026-08-01T15:05:22Z"
updated_at: "2026-08-01T19:07:37Z"
author:
  login: arthrod
  id: 89408329
  avatar_url: "https://avatars.githubusercontent.com/u/89408329?v=4"
  url: "https://api.github.com/users/arthrod"
assignees: []
labels:
  - id: 11668727539
    name: bug
    color: d73a4a
    description: Something isn't working
  - id: 11668727567
    name: help wanted
    color: 008672
    description: Extra attention is needed
  - id: 11695299927
    name: tech-debt
    color: ededed
  - id: 11695299936
    name: "size:L"
    color: ededed
url: "https://api.github.com/repos/arthrod/digest-law-us/issues/2"
html_url: "https://github.com/arthrod/digest-law-us/issues/2"
---

# CI cannot build: the corpus lives in a private sibling repo

CI has never passed on this repository — 6 runs, 6 failures as of PR #1, which was the first PR. Two of the three causes are now fixed; the third is structural and needs a decision.

## Fixed in #1

- **`ERR_PNPM_IGNORED_BUILDS`** at install (e10591c). pnpm refuses to run a dependency's install script unless it is named in `allowBuilds`. `workerd` arrived with wrangler; `lefthook` had never been listed.
- **`oxlint: not found`** at lint (ab6d6fb). `oxlint` and `oxfmt` are peerDependencies of ultracite, so declaring them is the consumer's job. bun hoists a resolved peer's binary into `node_modules/.bin`; pnpm links only direct dependencies, so the scripts had nothing to call.

## Not fixed — the build cannot run in CI

```
ENOENT: no such file or directory, scandir
  /home/runner/work/digest-law-us/key-digest-runner/key_digest/american_legal_digest/okf
```

`src/corpus.config.ts` resolves the corpus from a sibling checkout of the **private** `key-digest-runner` repo. The workflow checks out only this repository, so `pnpm run build` cannot succeed. This is not new: `main` carried the same dependency before #1, and the workflow is unchanged by it.

Options, roughly in order of how honest the resulting gate would be:

1. **Check out the corpus in CI.** Needs a deploy key or PAT with read access to the private repo, stored as a secret. Gives Actions access to the private corpus, and makes CI runs slow and large.
2. **Drop `build` from CI** and keep the gates that can pass without the corpus. A gate that cannot pass is worse than no gate — it trains everyone to ignore red.
3. **Build against a small fixture corpus** committed here, with `CORPUS_DIR` pointed at it. Proves the build works without exposing or shipping the real corpus, but only covers what the fixture contains.

## Separate gap, worth fixing at the same time

**CI does not run the test suite.** The workflow runs install, lint, `format:check`, build. `bun test src worker` (83 tests), `ids:check`, and `skos:check` are all bun-based and never execute on GitHub — so the tests gate nothing there, and `ids:check` in particular is what stops a purge from shipping half-done (concepts deleted, ids never retired).

This is also why both fixed failures above were invisible locally: the local gates run on bun, CI runs on pnpm. Running the same commands in both places would have caught them immediately. The repo maintains `bun.lock` and `pnpm-lock.yaml` in parallel, so a related question is whether CI should move to bun and drop `pnpm-lock.yaml` entirely.

## Also open, unrelated to CI

`bun run skos:check` reports **64 violations, all SKOS S27** — concepts asserting `skos:related` to something that is also a hierarchical ancestor or descendant. These are corpus data conflicts, not code faults, and are unchanged by #1. Fixing them is editorial work on the corpus.

---

**Author:** @arthrod
**Created:** 2026-08-01T15:05:22Z
**Updated:** 2026-08-01T19:07:37Z
**Labels:** bug, help wanted, tech-debt, size:L

---

## Comments

### @coderabbitai[bot] - 2026-08-01T15:05:37Z

<!-- This is an auto-generated issue plan by CodeRabbit -->
<details>
<summary>🔗 Related PRs</summary>

arthrod/jubarte-first#346 - fix(lint): suppress no-unreachable false positives in C# port files [merged]
arthrod/jubarte-first#475 - feat(prosemirror): PR1 — docx schema foundation + Phase-0 assembler gate [merged]
arthrod/jubarte-first#476 - test(prosemirror): fix PR `#475` Phase-0 seam gate — tracked fixtures + settings-less coverage [merged]
arthrod/jubarte-first#487 - fix(ci): runs-on label array is an AND — CI has been queueing forever since 2026-06-24 [merged]
arthrod/key-digest-runner#5132 - researchers: Municipal Law > MUNICIPAL CORPORATIONS > AUTHORITY AND ACTS OF MUNICIPAL CORPORATIONS > RATIFICATION OF MUNICIPAL ACTIONS [merged]
</details>

---

<details>
<summary>📝 Issue Planner</summary>

<sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>

- [ ] <!-- {"checkboxId": "8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan

</details>

---

<details>
<summary> 🧪 Issue enrichment is currently in open beta.</summary>

You can configure auto-planning by selecting labels in the issue_enrichment configuration.

To disable automatic issue enrichment, add the following to your `.coderabbit.yaml`:

```yaml
issue_enrichment:
  auto_enrich:
    enabled: false
```

</details>

💬 Have feedback or questions? Drop into our [discord](https://discord.gg/coderabbit)!

### @BabuBahir - 2026-08-01T19:07:37Z

I can take this issue , I just wanted to know more details on where the build cannot run on CI @arthrod
