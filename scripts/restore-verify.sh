#!/usr/bin/env sh
set -eu
archive=${1:?provide backup archive}
target=${2:?provide empty verification directory}
mkdir -p "$target"
tar -C "$target" -xzf "$archive"
test -f "$target/observation.db"
test -d "$target/media"
echo "backup structure verified: $target"
