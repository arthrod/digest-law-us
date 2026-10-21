#!/usr/bin/env bash
# Launch `pnpm run build && pnpm run deploy` in tmux session digest-build, logging
# to build-deploy-<stamp>.log. See docs/build-and-deploy.md.
#   ASTRO_PRERENDER_WORKERS  unset = 4 (the `pnpm run build` default); N overrides
#   SWAP_MAX                 scope swap cap (default 96G)
# A light memory logger samples the scope every MEMLOG_INTERVAL seconds (default
# 30) into build-deploy-<stamp>.mem.log: RAM, swap and peak of the scope, plus
# host free RAM/swap.
set -euo pipefail
cd /home/arthrod/workspace/digest-law-us
STAMP=$(date +%Y%m%d-%H%M)
LOG="$PWD/build-deploy-$STAMP.log"
SWAP_MAX=${SWAP_MAX:-96G}
WORKERS=${ASTRO_PRERENDER_WORKERS:-}
UNIT="digest-build-$STAMP"
MEMLOG="$PWD/build-deploy-$STAMP.mem.log"
MEMLOG_INTERVAL=${MEMLOG_INTERVAL:-30}
INNER=$(cat <<INNER_EOF
set -o pipefail
export PATH="\$HOME/.bun/bin:\$PATH"
cd $PWD
${WORKERS:+export ASTRO_PRERENDER_WORKERS=$WORKERS}
{
  echo "=== \$(date -Is) starting: pnpm run build && pnpm run deploy ==="
  echo "git: \$(git rev-parse --short HEAD); corpus: \$(git -C ../key-digest-runner rev-parse --short=10 HEAD)"
  echo "node \$(node --version), pnpm \$(pnpm --version), astro \$(pnpm exec astro --version 2>/dev/null)"
  echo "prerender workers: ${WORKERS:-4 (build default)}; scope MemoryMax=27G MemorySwapMax=$SWAP_MAX"
  free -h | sed -n '2,3p'
} 2>&1 | tee -a "$LOG"
(
  echo "time scope_ram scope_peak scope_swap host_avail host_swap_used"
  while sleep $MEMLOG_INTERVAL; do
    systemctl --user show $UNIT.scope -p MemoryCurrent -p MemorySwapCurrent -p MemoryPeak --value 2>/dev/null \\
      | numfmt --to=iec --invalid=ignore 2>/dev/null | paste -sd' ' \\
      | { read -r ram peak swap; case "\$ram" in ""|"[not"*) exit 0 ;; esac
          echo "\$(date +%H:%M:%S) \$ram \$peak \$swap \$(free -m | awk '/^Mem/{a=\$7}/^Swap/{s=\$3}END{print a"M", s"M"}')"; }
  done
) >> "$MEMLOG" 2>&1 &
MEMLOG_PID=\$!
systemd-run --user --scope -q --unit=$UNIT -p MemoryMax=27G -p MemorySwapMax=$SWAP_MAX \\
  bash -c 'set -o pipefail; { pnpm run build && pnpm run deploy; } 2>&1 | tee -a "\$0"' "$LOG"
rc=\$?
kill \$MEMLOG_PID 2>/dev/null
echo "=== \$(date -Is) RESULT exit=\$rc \$([ \$rc -eq 0 ] && echo COMPLETE || echo FAILED) ===" | tee -a "$LOG"
INNER_EOF
)
tmux kill-session -t digest-build 2>/dev/null || true
tmux new-session -d -s digest-build -c "$PWD" -x 220 -y 50 \
  "bash -c $(printf %q "$INNER"); echo; echo '[build finished — see $LOG]'; exec zsh"
echo "launched in tmux digest-build; log: $LOG; memory: $MEMLOG"
