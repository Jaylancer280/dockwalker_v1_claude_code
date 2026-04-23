#!/usr/bin/env bash
# Run Locations V1 schema verification against local Supabase (catches
# regressions on the new RPCs + columns from 00101-00104 + 00109 CHECK).
# Requires: Supabase local stack running with migrations and seed applied.
# Run after: supabase start && supabase db reset

set -e

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/verify_locations_schema.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "ERROR: SQL test file not found: $SQL_FILE"
  exit 1
fi

echo "=== Locations V1 Schema Verification ==="
echo ""
echo "Running: $SQL_FILE"
echo ""

if ! psql "$DB_URL" -f "$SQL_FILE" -v ON_ERROR_STOP=1 2>&1; then
  echo ""
  echo "ERROR: Locations schema verification failed."
  echo "One or more location-schema tests did not pass."
  exit 1
fi

echo ""
echo "=== LOCATIONS SCHEMA VERIFICATION PASSED ==="
