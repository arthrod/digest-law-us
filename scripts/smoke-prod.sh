#!/usr/bin/env bash
# Read-only smoke test for the deployed site (adapted from live-contracts).
# Usage: scripts/smoke-prod.sh                 # https://digest.law
#        H=https://digest-law.<sub>.workers.dev scripts/smoke-prod.sh
# Needs bash, curl, jq. Exits 1 when any check fails. It only reads; the
# MCP calls are the public read-only tools.
H=${H:-https://digest.law}
UA='Mozilla/5.0 (X11; Linux x86_64) digest-law-smoke'
fail=0
t() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (want '$2', got '$3')"; fail=1; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' -m 30 -A "$UA" "$@"; }
ctype() { curl -s -o /dev/null -w '%{content_type}' -m 30 -A "$UA" "$@"; }
rpc() {
  curl -s -m 30 -A "$UA" -X POST "$H/mcp" -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' -d "$1"
}
call() { rpc "{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"; }

title=$(curl -s -m 30 -A "$UA" "$H/" | grep -o -i '<title[^>]*>[^<]*' | head -1)
case "$title" in *"American Legal Digest"*) echo "ok   home title" ;; *) echo "FAIL home title: $title"; fail=1 ;; esac
t "robots.txt names the sitemap" 1 "$(curl -s -m 30 -A "$UA" "$H/robots.txt" | grep -c 'digest.law/sitemap-index.xml')"
t "sitemap index" 200 "$(code "$H/sitemap-index.xml")"
t "MCP server card" 200 "$(code "$H/.well-known/mcp/server-card.json")"
t "MCP server card is JSON" application/json "$(ctype "$H/.well-known/mcp/server-card.json" | cut -d';' -f1)"
t "API catalog type" application/linkset+json "$(ctype "$H/.well-known/api-catalog" | cut -d';' -f1)"
t "agent skills index" 200 "$(code "$H/.well-known/agent-skills/index.json")"
t "home page Link: api-catalog" 1 "$(curl -s -I -m 30 -A "$UA" "$H/" | grep -i '^link:' | grep -c 'rel="api-catalog"')"
t "robots.txt Content-Signal" 1 "$(curl -s -m 30 -A "$UA" "$H/robots.txt" | grep -c '^Content-Signal: ')"
t "RSS feed" 200 "$(code "$H/rss.xml")"
t "RSS is application/rss+xml" application/rss+xml "$(ctype "$H/rss.xml" | cut -d';' -f1)"
t "WebMCP script" 200 "$(code "$H/webmcp.js")"
t "pages load the WebMCP script" 1 "$(curl -s -m 30 -A "$UA" "$H/" | grep -c 'src="/webmcp.js"')"
t "pages link the feed" 1 "$(curl -s -m 30 -A "$UA" "$H/" | grep -c 'type="application/rss+xml"')"
t "RSS lists 50 digests" 50 "$(curl -s -m 30 -A "$UA" "$H/rss.xml" | grep -o '<item>' | wc -l | tr -d ' ')"
md="$H/evidence-law/proof-of-writings/"
t "markdown on Accept: text/markdown" text/markdown "$(ctype -H 'accept: text/markdown' "$md" | cut -d';' -f1)"
t "markdown says its token count" 1 "$(curl -s -o /dev/null -D - -m 30 -A "$UA" -H 'accept: text/markdown' "$md" | grep -ci '^x-markdown-tokens: [0-9]')"
t "a browser still gets HTML" text/html "$(ctype "$md" | cut -d';' -f1)"
t "HTML varies on Accept" 1 "$(curl -s -I -m 30 -A "$UA" "$md" | grep -i '^vary:' | grep -ci 'accept')"
t "GET /mcp is 405" 405 "$(code "$H/mcp")"
t "initialize" digest-law "$(rpc '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | jq -r '.result.serverInfo.name')"
t "tools/list" "get_concept,list_concepts,search_concepts" \
  "$(rpc '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq -r '[.result.tools[].name]|sort|join(",")')"

search=$(call search_concepts '{"query":"evidence","limit":1}')
t "search_concepts answers" false "$(jq -r '.result.isError // false' <<<"$search")"
url=$(jq -r '.result.content[0].text | fromjson? | .items[0].url // empty' <<<"$search")
if [ -n "$url" ]; then
  t "a search hit's page exists" 200 "$(code "$url")"
else
  echo "FAIL a search hit's page exists (no hit: $(jq -c '.result.content[0].text' <<<"$search" | cut -c1-120))"; fail=1
fi
exit $fail
