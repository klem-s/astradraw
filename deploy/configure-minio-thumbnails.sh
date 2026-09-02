#!/usr/bin/env bash
# Configure MinIO to make thumbnails publicly readable
set -e

cd "$(dirname "$0")/.."

if [ -f deploy/.env ]; then
    set -a
    source deploy/.env
    set +a
fi

BUCKET="${S3_BUCKET:-excalidraw}"

# Works with either Docker or Podman; COMPOSE/COMPOSE_FILES can be preset by
# the caller (see Justfile), otherwise detect the available engine here.
if [ -z "$COMPOSE" ]; then
    if command -v docker >/dev/null 2>&1; then
        COMPOSE="docker compose"
    elif command -v podman-compose >/dev/null 2>&1; then
        COMPOSE="podman-compose"
    else
        COMPOSE="podman compose"
    fi
fi
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.infra.yml}"

# Wait for MinIO to be ready
sleep 2

# Configure public access for thumbnails folder
(cd deploy && $COMPOSE $COMPOSE_FILES exec -T minio sh -c '
    ACCESS_KEY=$(cat /run/secrets/minio_access_key)
    SECRET_KEY=$(cat /run/secrets/minio_secret_key)
    mc alias set local http://localhost:9000 "$ACCESS_KEY" "$SECRET_KEY" 2>/dev/null || true
    mc anonymous set download local/'"$BUCKET"'/thumbnails 2>/dev/null || true
') > /dev/null 2>&1 && echo "   ✅ Thumbnails folder configured for public read" || echo "   ⚠️  Could not configure thumbnails (bucket may not exist yet)"












