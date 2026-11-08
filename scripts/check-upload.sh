#!/usr/bin/env bash
# Where does the newest build+deploy run stand, and is it moving?
#
# Meant for cron, every 30 minutes while a `./build-deploy-tmux.sh` run is in
# flight (see docs/build-and-deploy.md). One line per sample goes to stdout, so
# cron mail shows the history; the state file keeps the previous sample so a
# run that stopped writing to its log can be called out.
#
#   scripts/check-upload.sh              # one sample
#   UPLOAD_MONITOR_QUIET=1 scripts/...   # nothing on stdout unless something is wrong
#
# Exit codes: 0 fine (building, uploading, or a complete run), 1 the run failed,
# 2 the run looks stalled (its log has not grown in STALL_MIN minutes), 3 there
# is no run to look at.
#
# A run is the launcher's: `pnpm run build && pnpm run check:head && pnpm run
# deploy`, logging to build-deploy-<stamp>.log in the repo root.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 3

STATE_DIR=${UPLOAD_MONITOR_STATE:-"$HOME/.local/state/digest-upload-monitor"}
STATE="$STATE_DIR/last-sample"
STALL_MIN=${STALL_MIN:-45}
SHARDS_EXPECTED=${SHARDS_EXPECTED:-10}
mkdir -p "$STATE_DIR"

LOG=$(ls -t build-deploy-*.log 2>/dev/null | head -1)
if [ -z "$LOG" ]; then
  echo "no build-deploy-*.log here: nothing to monitor"
  exit 3
fi

now=$(date +%s)
log_age_min=$(( (now - $(stat -c %Y "$LOG")) / 60 ))
size=$(stat -c %s "$LOG")

# The launcher writes "=== <iso> RESULT exit=<n> COMPLETE|FAILED ===" last.
result=$(grep -a 'RESULT exit=' "$LOG" | tail -1)

if [ -n "$result" ]; then
  rc=$(printf '%s' "$result" | sed -n 's/.*RESULT exit=\([0-9]*\).*/\1/p')
  if [ "$rc" = "0" ]; then
    echo "$(date -Is) DONE $(basename "$LOG") — $(printf '%s' "$result" | sed 's/^=== //; s/ ===$//')"
    exit 0
  fi
  echo "$(date -Is) FAILED exit=$rc $(basename "$LOG") — last lines that are not page progress:"
  grep -av -e '├─' -e '└─' -e '^ *$' "$LOG" | tail -6
  exit 1
fi

# Upload phase: one "=== deploying <worker> ===" line per Worker, shards first.
shards_started=$(grep -ac '=== deploying digest-law-shard-' "$LOG")
uploading=$(grep -ac '=== deploying ' "$LOG")

# How long this phase may go without writing to the log before it is called
# stalled. Content sync writes nothing for hours by design (a cold 218-minute
# sync prints one line at the start and one at the end); a shard upload goes
# quiet for ~30 minutes while wrangler writes its debug log; rendering logs
# every page, so half an hour of silence there is a real hang.
stall_min=$STALL_MIN

if [ "$shards_started" -gt 0 ]; then
  stall_min=$(( STALL_MIN * 2 ))
  current=$(grep -a '=== deploying ' "$LOG" | tail -1 | sed 's/=== deploying //; s/ ===$//')
  # "Uploaded"/"Version ID" lines prove the current Worker's files are on their
  # way; wrangler then spends ~30 min writing its debug log before moving on.
  if [ "$(printf '%s' "$current" | grep -c 'root')" -gt 0 ]; then
    phase="UPLOAD root worker (the cutover: nothing changes for visitors until this finishes)"
  else
    phase="UPLOAD $current ($shards_started/$SHARDS_EXPECTED shards started, then root)"
  fi
elif [ "$(grep -ac 'check:head' "$LOG")" -gt 0 ] || [ "$uploading" -gt 0 ]; then
  phase="GATE check:head (the build finished; the deploy is next)"
elif [ "$(grep -ac 'Complete!' "$LOG")" -gt 0 ]; then
  phase="AFTERBUILD catalog/pagefind (rendering done)"
elif [ "$(grep -ac 'Building static entrypoints' "$LOG")" -gt 0 ] ||
  [ "$(grep -ac 'Rearranging server assets' "$LOG")" -gt 0 ]; then
  pages=$(grep -ac '├─ /' "$LOG" 2>/dev/null)
  phase="RENDER $pages pages logged (of ~357k)"
elif [ "$(grep -ac 'Synced content' "$LOG")" -gt 0 ]; then
  phase="RENDER starting (content synced)"
else
  phase="SYNC content store (cold: ~218 min; nothing logs until it ends)"
  stall_min=360
fi

# Memory: the launcher samples the systemd scope every 30 s.
mem=$(ls -t build-deploy-*.mem.log 2>/dev/null | head -1)
memline=""
if [ -n "$mem" ]; then
  memline=$(tail -1 "$mem" | awk 'NF>=6{printf "ram=%s peak=%s swap=%s host_avail=%s", $2, $3, $4, $5}')
fi

prev_line=""
[ -f "$STATE" ] && prev_line=$(cat "$STATE")
prev_size=${prev_line%% *}

status=0
note=""
if [ -n "$prev_size" ] && [ "$size" = "$prev_size" ] && [ "$log_age_min" -ge "$stall_min" ]; then
  note=" STALLED: log has not grown in ${log_age_min}m"
  status=2
elif [ "$log_age_min" -ge "$stall_min" ]; then
  note=" quiet ${log_age_min}m (a shard upload looks like this for ~30m; a cold sync for hours)"
fi

line="$(date -Is) $phase | log $(numfmt --to=iec "$size") last write ${log_age_min}m ago ${memline}${note}"
printf '%s %s\n' "$size" "$line" > "$STATE"

if [ "${UPLOAD_MONITOR_QUIET:-0}" = "1" ] && [ "$status" -eq 0 ]; then
  exit 0
fi
echo "$line"
exit "$status"
