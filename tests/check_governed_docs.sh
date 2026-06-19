#!/usr/bin/env bash
# Verify all governed documentation files are tracked in git.
# See CLAUDE.md Documentation Governance for the canonical list.

GOVERNED_DOCS=(
  "BUILD_STATE.md"
  "README.md"
  "apps/web/README.md"
  "packages/db/README.md"
  "packages/types/README.md"
  "supabase/README.md"
)

MISSING=0

for doc in "${GOVERNED_DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "ERROR: Governed doc missing from repo: $doc"
    MISSING=1
  elif ! git ls-files --error-unmatch "$doc" > /dev/null 2>&1; then
    echo "ERROR: Governed doc exists but is not tracked in git: $doc"
    MISSING=1
  fi
done

if [ "$MISSING" = "1" ]; then
  echo ""
  echo "One or more governed docs are missing or untracked."
  echo "See CLAUDE.md Documentation Governance for the required file list."
  exit 1
fi

echo "All governed docs are present and tracked."
exit 0
