#!/usr/bin/env bash
# Block commits containing TODO comments in source files (not test files)

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | grep -v '__tests__/')

if [ -z "$STAGED" ]; then
  exit 0
fi

FOUND=$(echo "$STAGED" | xargs grep -n 'TODO' 2>/dev/null)

if [ -n "$FOUND" ]; then
  echo ""
  echo "ERROR: TODO comments found in staged files:"
  echo "$FOUND"
  echo ""
  echo "Use 'Deferred:' prefix instead, or add to Deferred Decisions in BUILD_STATE.md."
  exit 1
fi

exit 0
