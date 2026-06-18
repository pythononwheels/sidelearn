#!/usr/bin/env bash
# Run ON the prod host inside the checkout (e.g. /opt/sidelearn/server).
# Pulls latest, rebuilds the image, restarts the container, smoke-tests /health.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "no server/.env on prod host. cp .env.example .env, then set the key." >&2
  exit 2
fi

set -a; . ./.env; set +a
PORT="${SL_PORT:-9990}"

echo "→ git pull"
git -C .. pull --ff-only

echo "→ docker compose build"
docker compose -f docker-compose.prod.yml build

echo "→ docker compose up -d"
docker compose -f docker-compose.prod.yml up -d

echo "→ waiting for /health on 127.0.0.1:$PORT"
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "  healthy"
    echo "deployed. (first run builds today's lessons in the background)"
    exit 0
  fi
  sleep 1
done

echo "health check failed after 20s. last logs:" >&2
docker compose -f docker-compose.prod.yml logs --tail=50 >&2
exit 1
