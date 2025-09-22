#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-.data/backups}"
DB_NAME="${DB_NAME:-equipment_rental}"
CONTAINER="pfreservations-db-1"

mkdir -p "$OUT_DIR"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$OUT_DIR/${DB_NAME}-$TS.sql"

echo "Backing up database to $FILE"
docker compose exec -T db pg_dump -U equipment_user "$DB_NAME" > "$FILE"
echo "Backup complete: $FILE"

