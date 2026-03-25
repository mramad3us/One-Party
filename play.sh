#!/usr/bin/env bash
# Launch One Party dev server and open in browser.
# Works fully offline — no external dependencies.

set -euo pipefail
cd "$(dirname "$0")"

PORT="${1:-5173}"
VERSION=$(node -p "require('./package.json').version")

# Install deps if needed (only first run)
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "🎲 One Party v${VERSION}"
echo "Starting on http://localhost:$PORT ..."

# Start vite dev server in background
npx vite --port "$PORT" &
VITE_PID=$!

# Wait for the server to be ready
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Open browser
if command -v open > /dev/null 2>&1; then
  open "http://localhost:$PORT"
elif command -v xdg-open > /dev/null 2>&1; then
  xdg-open "http://localhost:$PORT"
fi

echo "Press Ctrl+C to stop."

# Keep running until interrupted
trap "kill $VITE_PID 2>/dev/null; exit 0" INT TERM
wait $VITE_PID
