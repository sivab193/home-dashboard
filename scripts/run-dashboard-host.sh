#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

caddy_bin=""
for candidate in /opt/homebrew/bin/caddy /usr/local/bin/caddy; do
  if [ -x "$candidate" ]; then
    caddy_bin="$candidate"
    break
  fi
done
if [ -z "$caddy_bin" ]; then
  echo "Caddy is not installed" >&2
  exit 1
fi

mkdir -p data/dashboard
export DASHBOARD_ROOT="$PWD/www"
exec "$caddy_bin" run --config "$PWD/deploy/Caddyfile" --adapter caddyfile \
  >>data/dashboard/dashboard.log 2>&1
