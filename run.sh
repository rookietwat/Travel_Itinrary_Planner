#!/usr/bin/env bash
# One command to run Wayfare: API on :8001, web app on :5175. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
[ -d frontend/node_modules ] || (cd frontend && npm install --no-audit --no-fund)
[ -f backend/.env ] || cp backend/.env.example backend/.env

(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8001) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
cd frontend && npm run dev
