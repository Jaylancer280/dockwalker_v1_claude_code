#!/usr/bin/env bash
# Check that all aggregateType values used in API routes are present in the
# events table CHECK constraint. Prevents the class of bug where a new
# aggregate_type is used in code but never added to the DB constraint.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/web/src/app/api"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

# 1. Extract all unique aggregateType string values from API routes
CODE_TYPES=$(grep -roh "aggregateType: '[^']*'" "$API_DIR" 2>/dev/null \
  | sed "s/aggregateType: '//;s/'//" \
  | sort -u)

if [ -z "$CODE_TYPES" ]; then
  echo "No aggregateType values found in API routes — skipping check."
  exit 0
fi

# 2. Find the latest migration that defines events_aggregate_type_check
# The constraint may span multiple lines, so grep the file that contains it
# and extract all quoted strings from the check(...in(...)) clause.
CONSTRAINT_FILE=$(grep -rl "events_aggregate_type_check" "$MIGRATIONS_DIR" 2>/dev/null | sort | tail -1)

if [ -z "$CONSTRAINT_FILE" ]; then
  echo "ERROR: Could not find events_aggregate_type_check constraint in migrations."
  exit 1
fi

# 3. Extract allowed values — get all single-quoted strings near the constraint
DB_TYPES=$(grep -A2 "events_aggregate_type_check" "$CONSTRAINT_FILE" \
  | grep -o "'[^']*'" \
  | sed "s/'//g" \
  | sort -u)

# 4. Compare: every code type must be in DB types
MISSING=""
for t in $CODE_TYPES; do
  if ! echo "$DB_TYPES" | grep -qx "$t"; then
    MISSING="$MISSING $t"
  fi
done

if [ -n "$MISSING" ]; then
  echo "ERROR: aggregateType values used in code but missing from events_aggregate_type_check:"
  echo " $MISSING"
  echo ""
  echo "Add the missing values to the CHECK constraint via a new migration."
  exit 1
fi

echo "aggregate_type check passed — all code values present in DB constraint."
