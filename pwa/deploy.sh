#!/usr/bin/env bash
# Deploy the Learny PWA to learny.pyrates.io (static, behind Caddy).
# Builds, then rsyncs .output/pwa → /opt/learny on the host.
#
#   SSH_TARGET=khz@pyrates.io ./pwa/deploy.sh
#   SSH_TARGET=khz@pyrates.io ./pwa/deploy.sh --dry-run
#
# Host setup (once): sudo mkdir -p /opt/learny && sudo chown khz:khz /opt/learny
# Caddy block to append to /etc/caddy/Caddyfile (then validate + reload) — minimal,
# matching the other y-apps; the service worker handles caching/offline:
#   learny.pyrates.io {
#       import security_headers
#       root * /opt/learny
#       file_server
#   }
#
# SAFETY: no --delete by default (rsync can only add/update — cannot remove
# anything on the server). The path guard refuses any REMOTE_PATH whose leaf is
# not 'learny' (so a typo can't touch sibling apps in shared /opt).
set -euo pipefail

SSH_TARGET="${SSH_TARGET:?set SSH_TARGET, e.g. SSH_TARGET=khz@pyrates.io}"
REMOTE_PATH="${REMOTE_PATH:-/opt/learny}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

leaf="$(basename "${REMOTE_PATH%/}")"
if [ "$leaf" != "learny" ]; then
  echo "✗ Refusing REMOTE_PATH='$REMOTE_PATH' — leaf must be 'learny'." >&2
  exit 1
fi

echo "→ Building PWA…"
( cd "$ROOT" && npm run pwa:build )

DIST="$ROOT/.output/pwa"
[ -f "$DIST/index.html" ] || { echo "✗ build missing at $DIST" >&2; exit 1; }
# Normalise perms so Caddy can traverse/read (house convention 755/644).
chmod -R u=rwX,go=rX "$DIST"

echo "→ rsync${DRY:+ (dry-run)} → ${SSH_TARGET}:${REMOTE_PATH}/"
rsync -avz $DRY "$DIST/" "${SSH_TARGET}:${REMOTE_PATH}/"
echo "✓ Done."
