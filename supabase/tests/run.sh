#!/usr/bin/env bash
# Runs the database tests in a throwaway Postgres container (owner: Waddah). Needs Docker.
# Applies every migration in order, then supabase/tests/db_test.sql. Never touches a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
name=trimtl-db-test
docker rm -f "$name" >/dev/null 2>&1 || true
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -e POSTGRES_PASSWORD=test postgres:16 >/dev/null
# pg_isready can answer during the image's init restart, so wait for a real query to succeed.
for _ in $(seq 1 60); do docker exec "$name" psql -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
psql() { docker exec -i "$name" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
psql < tests/auth_stub.sql
for f in migrations/*.sql; do psql < "$f"; done
psql < tests/db_test.sql
