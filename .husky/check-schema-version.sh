#!/usr/bin/env bash
# Verify BUILD_STATE.md schema version matches the actual migration count.

MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
STATED_VERSION=$(grep -oP '^v\K[0-9]+' BUILD_STATE.md 2>/dev/null | head -1)

if [ -z "$STATED_VERSION" ]; then
  echo ""
  echo "WARNING: Could not parse schema version from BUILD_STATE.md."
  echo "  Expected a line like: v7 — description (N migrations applied)"
  echo ""
  exit 1
fi

if [ "$MIGRATION_COUNT" != "$STATED_VERSION" ]; then
  echo ""
  echo "ERROR: Schema version mismatch."
  echo "  BUILD_STATE.md says: v${STATED_VERSION}"
  echo "  Actual migration files: ${MIGRATION_COUNT}"
  echo ""
  echo "  Update the 'Current Schema Version' line in BUILD_STATE.md."
  exit 1
fi

exit 0
