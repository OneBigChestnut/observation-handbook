#!/usr/bin/env sh
set -eu
data_dir=${DATA_DIR:-/data}
backup_dir=${BACKUP_DIR:-/backups}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup_dir"
tar -C "$data_dir" -czf "$backup_dir/observation-handbook-$stamp.tgz" observation.db media
find "$backup_dir" -type f -name 'observation-handbook-*.tgz' -mtime +14 -delete
