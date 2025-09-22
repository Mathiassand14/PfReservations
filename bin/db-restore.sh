#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-}"
DB_NAME="${DB_NAME:-equipment_rental}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <backup.sql>"
  exit 1
fi
echo "Restoring $FILE into $DB_NAME"
docker compose exec -T db psql -U equipment_user -d "$DB_NAME" < "$FILE"
echo "Restore complete"

