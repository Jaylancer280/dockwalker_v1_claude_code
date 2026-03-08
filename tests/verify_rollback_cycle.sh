#!/usr/bin/env bash
# Verify rollback execution: forward -> reverse -> forward.
# Proves that rollbacks actually execute, not just that files exist.
#
# Requires: Supabase local stack running with migrations applied (supabase db reset).
# Run after: supabase start && supabase db reset

set -e

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

echo "=== Rollback Execution Verification ==="
echo ""

# Collect rollback files in reverse numeric order
ROLLBACKS=$(ls -1r supabase/rollbacks/*.down.sql 2>/dev/null)

if [ -z "$ROLLBACKS" ]; then
  echo "ERROR: No rollback files found in supabase/rollbacks/"
  exit 1
fi

echo "Step 1: Applying rollbacks in reverse order..."
for rollback in $ROLLBACKS; do
  echo "  Applying: $rollback"
  if ! psql "$DB_URL" -f "$rollback" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
    echo ""
    echo "ERROR: Rollback failed: $rollback"
    echo "Run manually for details: psql \"$DB_URL\" -f \"$rollback\""
    exit 1
  fi
done
echo "  All rollbacks applied successfully."
echo ""

echo "Step 2: Re-applying migrations via supabase db reset..."
if ! supabase db reset > /dev/null 2>&1; then
  echo ""
  echo "ERROR: supabase db reset failed after rollbacks."
  echo "The forward -> reverse -> forward cycle is broken."
  exit 1
fi
echo "  Migrations re-applied successfully."
echo ""

echo "=== ROLLBACK CYCLE VERIFIED ==="
