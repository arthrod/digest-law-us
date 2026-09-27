#!/usr/bin/env bash
# Full build + shard deploy for digest-law-us on netcup.
# Run under a memory-capped systemd transient unit so a runaway build
# cannot OOM Coolify / Temporal / the key-digest research fleet.
set -euo pipefail

export PATH="$HOME/.bun/bin:$PATH"
cd "$HOME/workspace/digest-law-us"

echo "=== $(date -Is) starting ==="
echo "corpus: $(find ../key-digest-runner/key_digest/american_legal_digest/okf -name index.md | wc -l) bundles"
free -h | sed -n 2p

echo "=== $(date -Is) BUILD ==="
bun run build

echo "=== $(date -Is) build done ==="
du -sh dist
find dist -type f | wc -l | xargs echo "dist files:"

echo "=== $(date -Is) DEPLOY ==="
bun scripts/deploy-shards.ts

echo "=== $(date -Is) COMPLETE ==="
