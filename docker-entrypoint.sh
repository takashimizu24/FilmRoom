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

echo "Starting FilmRoom ..."
exec node server.js
