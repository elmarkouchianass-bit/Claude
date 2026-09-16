#!/usr/bin/env bash
# Draait shopify theme check met de lokaal geïnstalleerde CLI.
set -euo pipefail
CLI="${SHOPIFY_CLI:-/tmp/claude-0/-home-user-Claude/7d96aa51-1b7b-5cfb-8453-7adb7095841e/scratchpad/clitool/node_modules/.bin/shopify}"
exec "$CLI" theme check "$@"
