#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL via Docker Compose (detached)
echo "Starting local PostgreSQL..."
docker compose up -d db

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U vibrantsocial >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timed out waiting for PostgreSQL." >&2
    exit 1
  fi
  sleep 1
done

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo ""
echo "Local database is ready!"
echo "Connection: postgresql://vibrantsocial:vibrantsocial@localhost:5434/vibrantsocial"
