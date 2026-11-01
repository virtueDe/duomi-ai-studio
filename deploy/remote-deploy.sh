#!/usr/bin/env bash
# Update only the Duomi AI Studio application container on a remote host.

set -Eeuo pipefail

DEPLOY_DIR=${1:?deployment directory is required}
COMPOSE_FILE=${2:?compose file is required}
IMAGE=${3:?image is required}

cd "$DEPLOY_DIR"
test -f "$COMPOSE_FILE"
test -n "$IMAGE"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

timestamp=$(date +%Y%m%d-%H%M%S)
if [ -f .env ]; then
  cp -- .env ".env.backup.${timestamp}"
else
  : > .env
fi

tmp_env=".env.tmp.${timestamp}"
awk -v image="$IMAGE" '
  BEGIN { updated = 0 }
  /^DUOMI_IMAGE=/ {
    print "DUOMI_IMAGE=" image
    updated = 1
    next
  }
  { print }
  END {
    if (!updated) print "DUOMI_IMAGE=" image
  }
' .env > "$tmp_env"
mv -- "$tmp_env" .env

if ! compose config --quiet; then
  cp -- ".env.backup.${timestamp}" .env
  echo "Duomi compose configuration is invalid; restored previous .env" >&2
  exit 1
fi

if ! compose pull app mariadb || ! compose up -d app; then
  cp -- ".env.backup.${timestamp}" .env
  echo "Duomi deployment failed; restored previous .env" >&2
  exit 1
fi

compose ps app
echo "Duomi deployment started: ${IMAGE}"
