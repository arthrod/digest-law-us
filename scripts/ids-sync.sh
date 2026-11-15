#!/usr/bin/env bash
# Keep the concept-identity registry in step with the corpus, unattended.
#
# The runner's fleet merges new bundles all day and nothing in the runner
# mints concept ids, so the registry falls behind and `deploy` (which starts
# with `ids:check`) refuses to publish. This mints against the runner's
# origin/main in a dedicated worktree — never the operator's checkout — and
# lands the registry change as a merged PR. Idempotent: a no-op when nothing
# is unminted or orphaned. Run hourly by ops/systemd/digest-ids-sync.timer.
set -euo pipefail

# A systemd unit hands us a minimal PATH, and bun moved out of ~/.bun/bin into
# the vite-plus toolchain — the unit then died 127 every hour, so the registry
# silently stopped keeping up and `deploy` refused to publish. Resolve the
# binary here instead of trusting whoever launched us.
BUN="$(command -v bun || true)"
if [ -z "$BUN" ]; then
  for candidate in \
    "$HOME/.vite-plus/bin/bun" \
    "$HOME/.bun/bin/bun" \
    /usr/local/bin/bun \
    /usr/bin/bun; do
    if [ -x "$candidate" ]; then
      BUN="$candidate"
      break
    fi
  done
fi
if [ -z "$BUN" ]; then
  echo "ids-sync: bun not found on PATH or in ~/.vite-plus/bin, ~/.bun/bin, /usr/local/bin, /usr/bin" >&2
  exit 127
fi

SITE="${SITE_REPO:-$HOME/workspace/digest-law-us}"
RUNNER="${RUNNER_REPO:-$HOME/workspace/key-digest-runner}"
WT="${IDS_SYNC_WORKTREE:-$HOME/workspace/.digest-law-ids-sync}"
REPO="${IDS_SYNC_GH_REPO:-arthrod/digest-law-us}"

exec 9>"/tmp/digest-ids-sync.lock"
flock -n 9 || { echo "ids-sync: another run in progress"; exit 0; }

git -C "$RUNNER" fetch -q origin main
git -C "$SITE" fetch -q origin main
if [ ! -d "$WT" ]; then
  git -C "$SITE" worktree add -q --detach "$WT" origin/main
fi
cd "$WT"
git reset -q --hard
git checkout -q --detach origin/main

"$BUN" scripts/mint-concept-ids.ts --from-git "$RUNNER" origin/main
if git diff --quiet -- src/data/concept-ids.json; then
  echo "ids-sync: registry already in step"
  exit 0
fi
"$BUN" scripts/mint-concept-ids.ts --check --from-git "$RUNNER" origin/main

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
branch="chore/ids-sync-$stamp"
runner_sha="$(git -C "$RUNNER" rev-parse --short origin/main)"
git checkout -q -b "$branch"
git add src/data/concept-ids.json
git commit -q --no-verify -m "chore(ids): mint concepts for key-digest-runner@$runner_sha

Automated by scripts/ids-sync.sh (ops/systemd/digest-ids-sync.timer)."
git push -q origin "$branch"
url="$(gh pr create -R "$REPO" --base main --head "$branch" \
  --title "chore(ids): mint concepts for key-digest-runner@$runner_sha" \
  --body "Automated registry sync (\`scripts/ids-sync.sh\`): mints ids for corpus concepts on key-digest-runner \`origin/main\` @ $runner_sha and tombstones removed ones. \`ids:check --from-git\` passes on the result.")"
gh pr merge "${url##*/}" -R "$REPO" --merge --delete-branch
git checkout -q --detach origin/main
git branch -q -D "$branch"
echo "ids-sync: merged $url"
