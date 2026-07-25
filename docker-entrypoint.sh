#!/bin/sh
set -e

# Persistent volume location (mount your platform's volume here, e.g. Railway -> /app/data)
DATA_DIR="${DATA_DIR:-/app/data}"
DATABASE_FILE="${DATABASE_FILE:-$DATA_DIR/prod.db}"
export DATABASE_FILE

# Ensure the persistent directories exist
mkdir -p "$DATA_DIR/uploads"

# Serve uploaded files from the persistent volume so they survive restarts/redeploys
rm -rf /app/public/uploads
ln -sfn "$DATA_DIR/uploads" /app/public/uploads

# Create the database schema on first boot (idempotent: safe on every start)
echo "Initialising database at $DATABASE_FILE ..."
sqlite3 "$DATABASE_FILE" < /app/prisma/schema.sql

# Lightweight column migrations for existing databases (CREATE TABLE IF NOT EXISTS
# above won't alter tables that already exist). SQLite has no "ADD COLUMN IF NOT
# EXISTS", so ignore the "duplicate column" error when the column is already there.
sqlite3 "$DATABASE_FILE" 'ALTER TABLE "Message" ADD COLUMN "parentId" TEXT;' 2>/dev/null || true
sqlite3 "$DATABASE_FILE" 'ALTER TABLE "Message" ADD COLUMN "blockRef" INTEGER;' 2>/dev/null || true

echo "Starting FilmRoom ..."
exec node server.js
