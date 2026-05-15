#!/usr/bin/env bash
set -euo pipefail

PG_CONTAINER="${KURTTO_CLOUD_PG_CONTAINER:-kurtto-cloud-pg}"
REDIS_CONTAINER="${KURTTO_CLOUD_REDIS_CONTAINER:-kurtto-cloud-redis}"
PG_IMAGE="${KURTTO_CLOUD_PG_IMAGE:-postgres:18-alpine}"
REDIS_IMAGE="${KURTTO_CLOUD_REDIS_IMAGE:-redis:8.6-alpine}"
PG_PORT="${KURTTO_CLOUD_PG_PORT:-5432}"
REDIS_PORT="${KURTTO_CLOUD_REDIS_PORT:-6379}"

if command -v service >/dev/null 2>&1; then
  sudo service docker start >/dev/null 2>&1 || true
fi

if ! docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  docker run -d --name "$PG_CONTAINER" \
    -e POSTGRES_DB=kurtto \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -p "${PG_PORT}:5432" \
    "$PG_IMAGE"
elif ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  docker start "$PG_CONTAINER" >/dev/null
fi

until docker exec "$PG_CONTAINER" pg_isready -U postgres -d kurtto >/dev/null 2>&1; do
  sleep 1
done

docker exec "$PG_CONTAINER" psql -U postgres -d kurtto -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'kurtto_test'" | grep -q 1 \
  || docker exec "$PG_CONTAINER" psql -U postgres -d kurtto -c "CREATE DATABASE kurtto_test;"

if ! docker ps -a --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
  docker run -d --name "$REDIS_CONTAINER" \
    -p "${REDIS_PORT}:6379" \
    "$REDIS_IMAGE"
elif ! docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
  docker start "$REDIS_CONTAINER" >/dev/null
fi

until docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
