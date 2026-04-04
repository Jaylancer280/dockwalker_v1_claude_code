#!/usr/bin/env bash
# Block commits containing merge conflict markers in source files

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v '^scripts/')

if [ -z "$STAGED" ]; then
  exit 0
fi

FOUND=$(echo "$STAGED" | xargs grep -nE '^<{7}|^={7}|^>{7}' 2>/dev/null)

if [ -n "$FOUND" ]; then
  echo ""
  echo "ERROR: Merge conflict markers found in staged files:"
  echo "$FOUND"
  echo ""
  echo "Resolve merge conflicts before committing."
  exit 1
fi

exit 0
