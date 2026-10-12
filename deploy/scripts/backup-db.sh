#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
umask 077
mkdir -p backups
backup="accounts-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite"
# SQLite online backup includes committed WAL data without stopping the game.
docker compose exec -T server node --input-type=module -e '
import Database from "better-sqlite3";
const db = new Database(process.env.ACCOUNT_DB_PATH);
try { await db.backup("/data/" + process.argv[1]); } finally { db.close(); }
' "$backup"
docker compose cp "server:/data/$backup" "backups/$backup"
docker compose exec -T server node --input-type=module -e 'import {unlinkSync} from "node:fs"; unlinkSync("/data/" + process.argv[1]);' "$backup"
printf 'Backup: backups/%s\n' "$backup"
