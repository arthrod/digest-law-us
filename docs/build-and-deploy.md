# Full build and deploy

How the full-corpus build was made to finish (first complete run: 2026-10-21,
323,362 pages). Read this before changing anything about the build.

## TL;DR

```sh
pnpm run ids:check                 # deploy is gated on it; `pnpm run ids:mint` fixes it
./build-deploy-tmux.sh             # runs `pnpm run build && pnpm run deploy` in tmux
tmux attach -t digest-build        # watch (detach: Ctrl-b d)
tail -f build-deploy-<stamp>.log   # or follow the log
tail -f build-deploy-<stamp>.mem.log
grep 'RESULT exit' build-deploy-*.log   # how each run ended
```

`pnpm run build` alone is enough to produce `dist/`. It needs no environment
variables.

## What `pnpm run build` does

1. **Checks frontmatter and leaves out bad digests.** `pnpm run frontmatter:check`
   (`scripts/check-digest-frontmatter.ts`) parses every digest with Astro's
   frontmatter parser and runs the real `digestSchema`. This takes about 20
   seconds for 13.6k digests. Every failing file is written to
   `.frontmatter-excludes.json` (gitignored, rewritten on every build).
   `src/content.config.ts` reads that list and removes those files from the
   digests glob. A malformed digest therefore costs one page, not the whole
   build. Without this check, the build only finds a bad digest after hours of
   content sync, and then aborts. The failing files and the schema errors are
   printed at the top of the log; fix them upstream in the corpus. Use
   `bun scripts/check-digest-frontmatter.ts --strict` to fail instead, e.g. in
   CI.
2. **Checks the Astro store-writer patch.** `node scripts/patch-astro-store-writer.mjs --check`
   verifies the patch is still applied. A dependency bump can silently undo it;
   `pnpm install` re-applies it through `postinstall`.
3. **Runs `astro build` with 4 prerender workers.** It uses the incremental
   build and a 24 GB main heap:
   - `ASTRO_PRERENDER_WORKERS` defaults to **4**. Override it with
     `ASTRO_PRERENDER_WORKERS=N pnpm run build`, or 0 for a single thread.
   - `experimental.incrementalBuild` is on unless `ASTRO_INCREMENTAL=0`. Pages
     whose inputs did not change are skipped. The cache lives in `.astro-cache`,
     not `node_modules`, so reinstalling dependencies doesn't wipe it.
   - Up to `workers × build.concurrency` pages render at once.
     `build.concurrency` comes from `BUILD_CONCURRENCY` (default 1), so 4
     pages render in parallel. Raising it has not been measured; memory is the
     limit, so change one setting at a time and watch the memory log.
4. **Runs `pagefind --site dist`** (54,392 pages indexed) and copies the index
   into `public/`.

## Why 4 workers

All runs below were on the same 31 GB RAM machine, capped at 27 GB RAM plus
96 GB swap:

| Workers  | Rendering                                 | Peak swap       | Outcome                                  |
| -------- | ----------------------------------------- | --------------- | ---------------------------------------- |
| 1 (Sept) | ~126 pages/min                            | n/a             | 283,675 pages in 37.4 h                  |
| 11       | ~1,350 pages/min for 10 min, then ~10/min | 96 GB (the cap) | memory killer, at 13.7k pages            |
| **4**    | **~280–450 pages/min, steady**            | **54 GB**       | **323,362 pages; rendering took 19.7 h** |

Each worker loads the whole content store and builds its own corpus index, and
its memory keeps growing as it renders. Eleven workers ran fine for 10 minutes
and then went through 90+ GB of swap. More swap does not help: it only lets
the build thrash for longer.

**Keep the worker count the same between builds.** Changing it made Astro
print `Astro config changed` and clear the content store. The next sync is
then cold: about 3.5–4.3 h on this corpus. Upgrading Astro does the same.

## Timeline of a cold run (4 workers)

| Phase                       | Duration                                                   |
| --------------------------- | ---------------------------------------------------------- |
| Frontmatter check           | ~20 s                                                      |
| Content sync (cold)         | 218 min                                                    |
| Rendering                   | ~16 h (1179 min, counting from the start of `astro build`) |
| Pagefind                    | a few minutes                                              |
| Deploy: 10 shards plus root | ~45–50 min per shard; see below                            |

## Deploy

- `pnpm run deploy` is upload only: it runs `pnpm run ids:check`, then
  `bun scripts/deploy-shards.ts`. It does **not** build, so run it only after
  a successful `pnpm run build`. `./build-deploy-tmux.sh` chains the two with
  `&&`.
- `pnpm run deploy:full` builds and deploys in one command.
- **Shards.** `deploy-shards.ts` packs the top-level `dist/` folders into Workers
  `digest-law-shard-a` … `-j`, each under 80k files (Cloudflare caps a Worker at
  100k). Shards deploy first; the root `digest-law` Worker, which owns the
  custom domain, deploys last.
- **When the site changes.** Nothing changes for visitors until the root
  deploys; the old root keeps serving everything until then.
- **"No targets deployed"** after each shard is normal: shards have no route of
  their own.
- **Why shards are slow.** Each wrangler process keeps running at 100% CPU for
  about 30 minutes after it prints the shard's version ID. All that time goes
  into writing its debug log under `~/.config/.wrangler/logs/` (257 MB for one
  shard). It is not hung. Wrangler's log settings in `deploy-shards.ts` could
  probably shorten this; that is untested.

## Monitoring and memory

- `build-deploy-tmux.sh` runs the build inside a systemd scope with
  `MemoryMax=27G` and `MemorySwapMax=${SWAP_MAX:-96G}`. A runaway build gets
  killed for running out of memory without taking Coolify, Temporal or the
  research fleet with it.
- **Memory log.** The launcher logs `time scope_ram scope_peak scope_swap
  host_avail host_swap_used` every 30 s to `build-deploy-<stamp>.mem.log`.
- **Is it healthy?** During rendering, swap should level off (about 48–54 GB
  with 4 workers). If it keeps climbing toward the cap, the build will die.
- **Was it killed?** Run `sudo journalctl -k | grep 'Killed process'`. The
  user journal hides kernel messages.
- **Swap files.** `/swapfile` (8G), `/swapfile2` (16G) and `/swapfile3` (96G)
  are all in `/etc/fstab`. `/tmp` and `/dev/shm` are 16 GB in-memory
  filesystems, which the build barely uses. Don't grow them: whatever they hold
  comes out of RAM.

## Pitfalls we hit

- **Don't pipe the build into `tail`.** The pipe hides the exit code (see
  AGENTS.md). Judge success by the `RESULT exit=` line and by
  `page(s) built … Complete!`.
- **Don't edit a log that is being written with `sed -i`.** It swaps in a new
  file, and the writer keeps writing to the deleted one.
- **Don't edit the checkout a build or deploy is running from.**
  `deploy-shards.ts` and `worker/` are read during the deploy. Use a separate
  `git worktree` with its **own** `node_modules`. A symlinked `node_modules`
  plus `pnpm exec` will try to reinstall into the production tree.
- **Grep for errors with a pattern, not the word "error".** "error" is also a
  legal topic name in URLs (`appeal-and-error`); see AGENTS.md.
