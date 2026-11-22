#!/usr/bin/env bash
# Corpus cleaning that precedes a full deploy. `pnpm run deploy:full` runs it
# first, so the steps that used to be done by hand are part of the command:
#
#   1. adult-host sources   key_digest/purge_denied_sources.py   (host rule only)
#   2. HTTP 429 captures    key_digest/purge_429_captures.py
#   3. thin bundles         key_digest/purge_thin_bundles.py     (no retained source)
#   4. duplicate issues     key_digest/find_duplicate_issues.py  (report only)
#
# Steps 1-3 delete from the runner checkout this site builds from and write
# their own record under the runner's docs/. They do not commit: land the
# deletions upstream with a runner PR, or the next pull brings the files back.
# Step 4 never deletes — duplicates are candidates for a person to decide, and
# the decision is recorded in the runner's taxonomy_overlay/.
#
# Concept ids are NOT reconciled here (--no-reconcile): deploy:full mints once,
# right after this script, so the registry is rewritten a single time.
#
#   CORPUS_CLEAN_DRY=1   report what would be deleted, delete nothing
#   CORPUS_CLEAN_SKIP=1  skip the whole script (corpus already cleaned)
#   RUNNER_REPO=<path>   runner checkout (default ../key-digest-runner)
#   THIN_MAX_SOURCES=N   purge bundles with <= N sources (default 0)
set -euo pipefail

if [ "${CORPUS_CLEAN_SKIP:-0}" = "1" ]; then
  echo "corpus-clean: skipped (CORPUS_CLEAN_SKIP=1)"
  exit 0
fi

SITE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="${RUNNER_REPO:-$SITE/../key-digest-runner}"
TOOLS="$RUNNER/key_digest"
APPLY=(--apply)
[ "${CORPUS_CLEAN_DRY:-0}" = "1" ] && APPLY=()

command -v uv >/dev/null || { echo "corpus-clean: uv not found on PATH" >&2; exit 127; }
[ -d "$TOOLS" ] || { echo "corpus-clean: no runner checkout at $RUNNER" >&2; exit 1; }

step() { echo; echo "=== corpus-clean: $1 ==="; }

step "1/4 adult-host sources"
uv run "$TOOLS/purge_denied_sources.py" "${APPLY[@]}" --no-reconcile

step "2/4 HTTP 429 captures"
uv run "$TOOLS/purge_429_captures.py" "${APPLY[@]}" --no-reconcile

step "3/4 thin bundles (<= ${THIN_MAX_SOURCES:-0} sources)"
uv run "$TOOLS/purge_thin_bundles.py" --max-sources "${THIN_MAX_SOURCES:-0}" "${APPLY[@]}" --no-reconcile

step "4/4 duplicate issues (report only)"
REPORT="$SITE/.corpus-duplicates.json"
uv run "$TOOLS/find_duplicate_issues.py" shipped --json "$REPORT" | tail -n 5
echo "duplicate candidates written to $REPORT"

echo
if [ ${#APPLY[@]} -eq 0 ]; then
  echo "corpus-clean: dry run — nothing deleted"
else
  echo "corpus-clean: done. Uncommitted deletions in the runner checkout:"
  git -C "$RUNNER" status --short -- key_digest/american_legal_digest/okf 2>/dev/null | wc -l | xargs echo "  files changed:"
fi
