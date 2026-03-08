#!/usr/bin/env bash
# Warn when code directories change but related documentation files are not staged.
# This is a warning gate, not a hard block — some sessions legitimately touch code
# without documentation impact (e.g., pure refactors, test-only changes).

STAGED=$(git diff --cached --name-only)

warn() {
  echo ""
  echo "WARNING: $1"
  echo "  If this change affects documented behavior, stage the relevant .md file."
  echo "  To proceed anyway, re-run with SKIP_DOCS_CHECK=1 git commit ..."
  echo ""
}

if [ "${SKIP_DOCS_CHECK:-0}" = "1" ]; then
  exit 0
fi

ERRORS=0

# Check: migrations changed but BUILD_STATE.md not staged
if echo "$STAGED" | grep -q '^supabase/migrations/'; then
  if ! echo "$STAGED" | grep -q '^BUILD_STATE.md$'; then
    warn "supabase/migrations/ changed but BUILD_STATE.md not staged (schema version, migration table)."
    ERRORS=1
  fi
  if ! echo "$STAGED" | grep -q '^supabase/README.md$'; then
    warn "supabase/migrations/ changed but supabase/README.md not staged."
    ERRORS=1
  fi
fi

# Check: shared types changed but packages/types/README.md not staged
if echo "$STAGED" | grep -q '^packages/types/src/'; then
  if ! echo "$STAGED" | grep -q '^packages/types/README.md$'; then
    warn "packages/types/src/ changed but packages/types/README.md not staged."
    ERRORS=1
  fi
fi

# Check: db helpers changed but packages/db/README.md not staged
if echo "$STAGED" | grep -q '^packages/db/src/'; then
  if ! echo "$STAGED" | grep -q '^packages/db/README.md$'; then
    warn "packages/db/src/ changed but packages/db/README.md not staged."
    ERRORS=1
  fi
fi

# Check: API routes changed but apps/web/README.md not staged (new RPCs, env vars)
if echo "$STAGED" | grep -q '^apps/web/src/app/api/'; then
  if ! echo "$STAGED" | grep -q '^apps/web/README.md$'; then
    warn "apps/web/src/app/api/ changed but apps/web/README.md not staged (check if RPCs or env vars changed)."
    ERRORS=1
  fi
fi

if [ "$ERRORS" = "1" ]; then
  echo "To skip this check: SKIP_DOCS_CHECK=1 git commit ..."
  exit 1
fi

exit 0
