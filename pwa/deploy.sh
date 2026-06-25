#!/usr/bin/env bash
# Deploy Learny to learny.pyrates.io (static, behind Caddy).
#   - Landing page (pwa/landing/) → /opt/learny/          (site root "/")
#   - The PWA app  (.output/pwa/) → /opt/learny/app/      (served at "/app/")
# The app is built with base "/app/"; pwa/landing/sw.js is a kill-switch that
# replaces the old root service worker (the app used to live at "/").
#
#   SSH_TARGET=khz@pyrates.io ./pwa/deploy.sh
#   SSH_TARGET=khz@pyrates.io ./pwa/deploy.sh --dry-run
#
# Host setup (once): sudo mkdir -p /opt/learny && sudo chown khz:khz /opt/learny
# Caddy block: learny.pyrates.io { import security_headers; root * /opt/learny; file_server }
#
# SAFETY: no --delete (rsync only adds/updates). The path guard refuses any
# REMOTE_PATH whose leaf is not 'learny' (so a typo can't touch sibling apps).
set -euo pipefail

SSH_TARGET="${SSH_TARGET:?set SSH_TARGET, e.g. SSH_TARGET=khz@pyrates.io}"
# ENV selects the target: prod (learny.pyrates.io / /opt/learny) or
# dev (dev.learny.pyrates.io / /opt/learny-dev). REMOTE_PATH overrides.
ENV="${ENV:-prod}"
case "$ENV" in
  prod) DEFAULT_PATH="/opt/learny" ;;
  dev)  DEFAULT_PATH="/opt/learny-dev" ;;
  *) echo "✗ ENV must be 'prod' or 'dev' (got '$ENV')." >&2; exit 1 ;;
esac
REMOTE_PATH="${REMOTE_PATH:-$DEFAULT_PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

leaf="$(basename "${REMOTE_PATH%/}")"
if [ "$leaf" != "learny" ] && [ "$leaf" != "learny-dev" ]; then
  echo "✗ Refusing REMOTE_PATH='$REMOTE_PATH' — leaf must be 'learny' or 'learny-dev'." >&2
  exit 1
fi
echo "→ Target: $ENV → ${SSH_TARGET}:${REMOTE_PATH%/}/"

echo "→ Building PWA (base /app/)…"
( cd "$ROOT" && npm run pwa:build )

DIST="$ROOT/.output/pwa"
LANDING="$ROOT/pwa/landing"
[ -f "$DIST/index.html" ] || { echo "✗ app build missing at $DIST" >&2; exit 1; }
[ -f "$LANDING/index.html" ] || { echo "✗ landing missing at $LANDING" >&2; exit 1; }
# Normalise perms so Caddy can traverse/read (house convention 755/644).
chmod -R u=rwX,go=rX "$DIST" "$LANDING"

# 1) App → /opt/learny/app/  (do this first so the landing's root files land last)
echo "→ rsync${DRY:+ (dry-run)} app → ${SSH_TARGET}:${REMOTE_PATH}/app/"
rsync -avz $DRY "$DIST/" "${SSH_TARGET}:${REMOTE_PATH}/app/"

# 2) Landing (+ kill-switch sw.js, icons, gurki) → /opt/learny/  (site root)
echo "→ rsync${DRY:+ (dry-run)} landing → ${SSH_TARGET}:${REMOTE_PATH}/"
rsync -avz $DRY "$LANDING/" "${SSH_TARGET}:${REMOTE_PATH}/"
echo "✓ Done. Landing at /, app at /app/."
