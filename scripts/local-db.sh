#!/usr/bin/env bash
# Starts a local PostgreSQL 16 cluster for development and tests.
# Production uses Supabase Postgres; this cluster mimics the Supabase roles
# (anon, authenticated, service_role) and a minimal `auth` schema shim so the
# same migrations and RLS policies run unchanged. See DATABASE.md.
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
DATA_DIR="${LOCAL_PG_DIR:-$(pwd)/.data/pg}"
PORT="${LOCAL_PG_PORT:-54329}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then RUN_AS="runuser -u postgres --"; fi
mkdir -p "$DATA_DIR"
if [ -n "$RUN_AS" ]; then chown -R postgres:postgres "$(dirname "$DATA_DIR")"; fi
if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  $RUN_AS "$PGBIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust >/dev/null
  echo "port = $PORT" >> "$DATA_DIR/postgresql.conf"
  echo "listen_addresses = '127.0.0.1'" >> "$DATA_DIR/postgresql.conf"
  echo "unix_socket_directories = '/tmp'" >> "$DATA_DIR/postgresql.conf"
fi
if ! $RUN_AS "$PGBIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
  $RUN_AS "$PGBIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" -w start >/dev/null
fi
for db in trident trident_test; do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 \
    || psql -h 127.0.0.1 -p "$PORT" -U postgres -c "create database $db" >/dev/null
done
echo "Local Postgres running on 127.0.0.1:$PORT (databases: trident, trident_test)"
