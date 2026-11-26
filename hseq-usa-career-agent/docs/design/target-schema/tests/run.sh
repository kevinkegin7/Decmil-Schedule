#!/usr/bin/env bash
# Runs the migration and safeguard tests against a throwaway local database.
# Usage: supabase/tests/run.sh   (needs psql and a local Postgres 15+ superuser)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="hseq_test_$$"
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "create database $db" >/dev/null
trap '"${PSQL[@]}" -d postgres -c "drop database if exists $db" >/dev/null' EXIT
"${PSQL[@]}" -d "$db" -f "$here/00_supabase_stub.sql"
"${PSQL[@]}" -d "$db" -f "$here/../migrations/0001_initial_schema.sql"
"${PSQL[@]}" -d "$db" -f "$here/10_safeguards.sql" 2>&1 | sed 's/^psql:[^ ]* WARNING:  //'
