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
  if ! psql "$DB_URL" -f "$rollback" -v ON_ERROR_STOP=1 2>&1; then
    echo ""
    echo "ERROR: Rollback failed: $rollback"
    echo "Run manually for details: psql \"$DB_URL\" -f \"$rollback\""
    exit 1
  fi

  # Audit P0-2 (2026-04-30): smoke-check apply_projection coherence
  # after each rollback. Catches the "NOTICE-only rollback" pattern
  # (P0-1) where the function body wasn't restored and now references
  # dropped tables/columns.
  #
  # Two smoke probes fire if the function still exists:
  #   - CV.GENERATED — touches profiles.cv_handle / cv_generated_at
  #     (added in 00131). If the rollback chain left the CV.GENERATED
  #     handler in place after 00131's schema rollback dropped those
  #     columns, the call fails. In a correctly-restored chain the
  #     handler is gone and the call falls through the case dispatch
  #     to the default raise-notice branch — no error.
  #   - PERSON.HAT_CHANGED — universal sanity check that the function
  #     dispatches. Only references the persons table which exists at
  #     every state where apply_projection itself exists.
  #
  # Both probes use a non-existent person id so the UPDATE WHERE
  # affects 0 rows — no constraint violations possible.

  # Check for the 6-arg signature specifically — rollback 00014 creates a
  # 0-arg trigger version (legacy state from the dual-function era) that
  # would shadow proname-only checks. We only smoke-test the 6-arg
  # apply_projection that 00005's rollback drops.
  PROC_EXISTS=$(psql "$DB_URL" -tA -c "SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='apply_projection' AND p.pronargs=6);" 2>/dev/null | tr -d ' ')
  if [ "$PROC_EXISTS" = "t" ]; then
    PROFILES_EXISTS=$(psql "$DB_URL" -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles');" 2>/dev/null | tr -d ' ')
    PERSONS_EXISTS=$(psql "$DB_URL" -tA -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='persons');" 2>/dev/null | tr -d ' ')

    if [ "$PROFILES_EXISTS" = "t" ]; then
      if ! psql "$DB_URL" -tA -c "SELECT public.apply_projection('CV.GENERATED', '00000000-0000-0000-0000-000000000000', 'profile', 'crew', '{\"handle\":\"smoketest\"}'::jsonb, '00000000-0000-0000-0000-000000000000');" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
        echo ""
        echo "ERROR: apply_projection CV.GENERATED smoke FAILED after rollback: $rollback"
        echo "The function's CV.GENERATED handler is still present but profiles.cv_handle"
        echo "was dropped by an earlier rollback. This is the P0-1 'NOTICE-only rollback'"
        echo "pattern from the 2026-04-30 audit."
        echo ""
        echo "Run for diagnosis:"
        echo "  psql \"$DB_URL\" -c \"SELECT public.apply_projection('CV.GENERATED', '00000000-0000-0000-0000-000000000000', 'profile', 'crew', '{\\\"handle\\\":\\\"smoketest\\\"}'::jsonb, '00000000-0000-0000-0000-000000000000');\""
        echo ""
        echo "Fix: inline the prior CREATE OR REPLACE FUNCTION block into the rollback file"
        echo "that just ran. It should restore apply_projection to the prior version's body."
        exit 1
      fi
    fi

    if [ "$PERSONS_EXISTS" = "t" ]; then
      if ! psql "$DB_URL" -tA -c "SELECT public.apply_projection('PERSON.HAT_CHANGED', '00000000-0000-0000-0000-000000000000', 'person', 'crew', '{\"current_hat\":\"crew\"}'::jsonb, '00000000-0000-0000-0000-000000000000');" -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
        echo ""
        echo "ERROR: apply_projection PERSON.HAT_CHANGED smoke FAILED after rollback: $rollback"
        echo "The function dispatches to a branch that references dropped schema."
        echo "This is the P0-1 'NOTICE-only rollback' pattern from the 2026-04-30 audit."
        exit 1
      fi
    fi
  fi
done
echo "  All rollbacks applied successfully (with apply_projection smoke verified after each)."
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
