#!/usr/bin/env bash
# Keep the build running: relaunch `./build-deploy-tmux.sh` if the newest run
# died and nothing is in flight. Meant for cron, every 30 minutes, beside
# scripts/check-upload.sh (the two answer different questions: that one says
# where the run is, this one restarts it).
#
# A full build+deploy takes more than a day here, so an unattended failure used
# to mean the site sat on an old build until someone noticed. This restarts the
# chain, and refuses to restart in a loop: at most MAX_RELAUNCHES (4) per
# ROLLING_HOURS (24), never twice within COOLDOWN_MIN (30) minutes.
#
#   scripts/build-deploy-watchdog.sh            restart if needed
#   DRY_RUN=1 scripts/build-deploy-watchdog.sh  say what it would do
#   touch <state>/HOLD                          stop the restarts (still logged)
#
# Exit codes: 0 nothing to do or a restart was launched, 1 a restart was wanted
# but the rate limit refused it (worth a look by hand).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

STATE_DIR=${WATCHDOG_STATE:-"$HOME/.local/state/digest-upload-monitor"}
HOLD="$STATE_DIR/HOLD"
LEDGER="$STATE_DIR/relaunches"
MAX_RELAUNCHES=${MAX_RELAUNCHES:-4}
ROLLING_HOURS=${ROLLING_HOURS:-24}
COOLDOWN_MIN=${COOLDOWN_MIN:-30}
mkdir -p "$STATE_DIR"

DRY_RUN=${DRY_RUN:-0}
say() { echo "$(date -Is) $*"; }

[ -f "$HOLD" ] && exit 0

# Something is in flight: a tmux session, or the processes themselves (the
# session can be killed while its scope keeps running).
if tmux has-session -t digest-build 2>/dev/null; then
  exit 0
fi
if pgrep -f 'astro build|deploy-shards\.ts|pagefind --site' >/dev/null 2>&1; then
  exit 0
fi

# *.mem.log matches that glob too and is written every 30 s; it carries no
# phase markers, so pick only the run logs.
LOG=$(ls -t build-deploy-*.log 2>/dev/null | grep -v '\.mem\.log$' | head -1)
if [ -n "$LOG" ]; then
  if grep -aq 'RESULT exit=0' "$LOG"; then
    exit 0
  fi
  age_min=$(( ($(date +%s) - $(stat -c %Y "$LOG")) / 60 ))
  if ! grep -aq 'RESULT exit=' "$LOG" && [ "$age_min" -lt 10 ]; then
    # No verdict and it was writing a moment ago: give it a sample.
    exit 0
  fi
  why="$(basename "$LOG") ended: $(grep -a 'RESULT exit=' "$LOG" | tail -1 | sed 's/^=== //; s/ ===$//')"
  [ -n "$why" ] || why="$(basename "$LOG") stopped writing ${age_min}m ago with no verdict"
else
  why="no build-deploy log at all"
fi

# Rolling ledger of launch times, one epoch second per line.
now=$(date +%s)
cutoff=$(( now - (ROLLING_HOURS * 3600) ))
recent=0
if [ -f "$LEDGER" ]; then
  awk -v cut="$cutoff" '$1 >= cut' "$LEDGER" > "$LEDGER.tmp" && mv "$LEDGER.tmp" "$LEDGER"
  recent=$(wc -l < "$LEDGER")
  last=$(tail -1 "$LEDGER" 2>/dev/null || echo 0)
  if [ -n "${last:-}" ] && [ "$last" -gt 0 ] && [ $(( (now - last) / 60 )) -lt "$COOLDOWN_MIN" ]; then
    say "restart wanted but the last one was $(( (now - last) / 60 ))m ago (cooldown ${COOLDOWN_MIN}m): $why"
    exit 0
  fi
fi

if [ "$recent" -ge "$MAX_RELAUNCHES" ]; then
  say "REFUSED ($recent relaunches in ${ROLLING_HOURS}h, limit ${MAX_RELAUNCHES}): $why — touch $HOLD to silence, or look by hand"
  exit 1
fi

if [ "$DRY_RUN" = "1" ]; then
  say "would relaunch ($((recent + 1))/$MAX_RELAUNCHES in ${ROLLING_HOURS}h): $why"
  exit 0
fi
say "relaunching ($((recent + 1))/$MAX_RELAUNCHES in ${ROLLING_HOURS}h): $why"
printf '%s\n' "$now" >> "$LEDGER"
./build-deploy-tmux.sh
