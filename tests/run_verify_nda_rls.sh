#!/usr/bin/env bash
# Run NDA vessel RLS verification against the local Supabase database.
# Requires: Supabase local stack running with migrations and seed applied.
# Run after: supabase start && supabase db reset

set -e

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/verify_nda_rls.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "ERROR: SQL test file not found: $SQL_FILE"
  exit 1
fi

echo "=== NDA Vessel RLS Verification ==="
echo ""
echo "Running: $SQL_FILE"
echo ""

if ! psql "$DB_URL" -f "$SQL_FILE" -v ON_ERROR_STOP=1 2>&1; then
  echo ""
  echo "ERROR: NDA RLS verification failed."
  echo "One or more privacy tests did not pass."
  exit 1
fi

echo ""
echo "=== NDA RLS VERIFICATION PASSED ==="
