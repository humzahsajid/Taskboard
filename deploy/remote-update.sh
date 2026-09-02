#!/usr/bin/env bash
#
# Runs ON THE DROPLET during a deploy (invoked over SSH by
# .github/workflows/deploy.yml). Rolls the running stack forward to the image
# tag in $IMAGE_TAG. Safe to run by hand for a manual redeploy:
#
#   cd /opt/taskboard
#   IMAGE_TAG=latest GH_ACTOR=<you> GH_TOKEN=<a PAT with read:packages> \
#     bash deploy/remote-update.sh
#
set -euo pipefail

APP_DIR="/opt/taskboard"
COMPOSE_FILE="docker-compose.prod.yml"
: "${IMAGE_TAG:=latest}"

cd "$APP_DIR"

if [ -n "${GH_TOKEN:-}" ]; then
  echo "$GH_TOKEN" | docker login ghcr.io -u "${GH_ACTOR:?GH_ACTOR required}" --password-stdin
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

echo "==> Pulling images (IMAGE_TAG=$IMAGE_TAG)"
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" pull --quiet

echo "==> Starting updated stack"
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> Waiting for the API to report healthy"
for i in $(seq 1 30); do
  if curl -fsS http://localhost/api/health >/dev/null 2>&1; then
    echo "    healthy after ${i} attempt(s)"
    break
  fi
  [ "$i" -eq 30 ] && { echo "    API did not become healthy"; docker compose -f "$COMPOSE_FILE" logs --tail=40 server; exit 1; }
  sleep 3
done

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo "==> Deployed. Running containers:"
docker compose -f "$COMPOSE_FILE" ps
