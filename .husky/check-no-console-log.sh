#!/usr/bin/env bash
# Block commits containing console.log in source files (not test files)

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | grep -v '__tests__/' | grep -v 'e2e/')

if [ -z "$STAGED" ]; then
  exit 0
fi

FOUND=$(echo "$STAGED" | xargs grep -n 'console\.log' 2>/dev/null)

if [ -n "$FOUND" ]; then
  echo ""
  echo "ERROR: console.log found in staged files:"
  echo "$FOUND"
  echo ""
  echo "Remove console.log statements before committing."
  exit 1
fi

exit 0
