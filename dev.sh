#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
PYTHON="$BACKEND_DIR/.venv/Scripts/python.exe"

if [[ ! -x "$PYTHON" ]]; then
  echo "Backend Python was not found at: $PYTHON"
  echo "Create it with: py -3.12 -m venv \"$BACKEND_DIR/.venv\""
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js, then reopen Git Bash."
  exit 1
fi

if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
  echo "Frontend dependencies are missing. From the project root, run: npm ci"
  exit 1
fi

backend_pid=""
frontend_pid=""

stop_services() {
  trap - INT TERM EXIT
  echo
  echo "Stopping SuryaFlex..."
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || wait "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || wait "$frontend_pid" 2>/dev/null || true
}

trap stop_services INT TERM EXIT

echo "Starting SuryaFlex backend at http://127.0.0.1:8000"
(cd "$BACKEND_DIR" && "$PYTHON" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000) &
backend_pid=$!

echo "Starting SuryaFlex frontend at http://localhost:5173"
(cd "$PROJECT_ROOT" && npm run dev -- --host 127.0.0.1) &
frontend_pid=$!

echo "Both services are starting. Keep this window open; press Ctrl+C to stop them."
wait "$backend_pid" "$frontend_pid"
