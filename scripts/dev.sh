#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

api_pid=""
cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! curl --silent --fail http://127.0.0.1:3001/health >/dev/null 2>&1; then
  APP_PORT=3001 go run ./backend &
  api_pid=$!
  for _ in {1..40}; do
    if curl --silent --fail http://127.0.0.1:3001/health >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

exec pnpm dev:ui "$@"
