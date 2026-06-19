#!/usr/bin/env bash
# Every new migration in supabase/migrations/ must have a rollback in supabase/rollbacks/

STAGED_MIGRATIONS=$(git diff --cached --name-only --diff-filter=A | grep '^supabase/migrations/.*\.sql$')

if [ -z "$STAGED_MIGRATIONS" ]; then
  exit 0
fi

MISSING=""
for migration in $STAGED_MIGRATIONS; do
  basename=$(basename "$migration" .sql)
  rollback="supabase/rollbacks/${basename}.down.sql"
  if [ ! -f "$rollback" ]; then
    # Also check if rollback is staged
    if ! git diff --cached --name-only | grep -q "^${rollback}$"; then
      MISSING="$MISSING\n  $migration -> missing $rollback"
    fi
  fi
done

if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: Migrations without rollback files:"
  echo -e "$MISSING"
  echo ""
  echo "Every migration must have a corresponding rollback in supabase/rollbacks/."
  exit 1
fi

exit 0
