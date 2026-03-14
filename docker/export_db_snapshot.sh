#!/bin/sh

set -eu

SNAPSHOT_PATH="${1:-../Data/db_snapshots/exam_e_snapshot.sql}"
SNAPSHOT_DIR=$(dirname "$SNAPSHOT_PATH")

mkdir -p "$SNAPSHOT_DIR"

echo "Exporting database snapshot to $SNAPSHOT_PATH ..."
docker compose exec -T db pg_dump -U postgres -d exam_e --clean --if-exists > "$SNAPSHOT_PATH"

echo "Snapshot export complete."
