#!/bin/sh
set -e

echo "==> Applying database migrations..."
npx prisma migrate deploy

echo "==> Seeding database (safe to run repeatedly)..."
node dist/prisma/seed.js || echo "Seed step skipped/failed (continuing)."

echo "==> Starting API server..."
exec node dist/src/index.js
