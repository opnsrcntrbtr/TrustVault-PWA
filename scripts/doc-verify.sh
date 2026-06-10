#!/usr/bin/env bash
set -euo pipefail

# doc-verify.sh - Verify documentation parity with codebase
# Usage: bash scripts/doc-verify.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

echo "Running TrustVault-PWA documentation verification..."

ERRORS=0

# Helper for reporting
fail() {
  echo "[FAIL] $1"
  ERRORS=$((ERRORS+1))
}
pass() {
  echo "[PASS] $1"
}

# 1) Check README.md for removed commands
if grep -E "test:integration|lighthouse:security" README.md >/dev/null 2>&1; then
  echo ""
  fail "README.md references removed scripts (test:integration or lighthouse:security)."
else
  pass "README.md contains no removed script references."
fi

# 2) Verify npm run commands in active docs exist in package.json
TMP_MENTIONED=$(mktemp)
TMP_SCRIPTS=$(mktemp)

# Extract mentioned npm run commands from key docs
grep -RIn "npm run [a-zA-Z0-9:_-]\+" README.md GETTING_STARTED.md DEPLOYMENT.md || true |
  sed -E "s/.*npm run ([a-zA-Z0-9:_-]+).*/\1/" | sort -u > "$TMP_MENTIONED" || true

# Extract actual scripts from package.json
jq -r '.scripts | keys[]' package.json | sort -u > "$TMP_SCRIPTS"

MISSING=$(comm -23 "$TMP_MENTIONED" "$TMP_SCRIPTS" || true)
if [ -n "$MISSING" ]; then
  fail "Documentation mentions npm scripts not found in package.json:\n$MISSING"
else
  pass "All mentioned npm scripts exist in package.json."
fi

rm -f "$TMP_MENTIONED" "$TMP_SCRIPTS"

# 3) Verify CSP parity between vercel.json and DEPLOYMENT.md (if both exist)
if [ -f vercel.json ] && [ -f DEPLOYMENT.md ]; then
  jq -r '.headers[]?.headers[] | select(.key=="Content-Security-Policy").value' vercel.json > /tmp/_vercel_csp || true
  # extract any CSP block in DEPLOYMENT.md (simple heuristic - look for Content-Security-Policy line)
  sed -n '/Content-Security-Policy/,/"/p' DEPLOYMENT.md > /tmp/_doc_csp || true

  if ! diff -u /tmp/_vercel_csp /tmp/_doc_csp >/dev/null 2>&1; then
    echo "--- vercel.json CSP ---"
    cat /tmp/_vercel_csp || true
    echo "--- DEPLOYMENT.md CSP ---"
    cat /tmp/_doc_csp || true
    fail "CSP in DEPLOYMENT.md does not match vercel.json."
  else
    pass "CSP in DEPLOYMENT.md matches vercel.json."
  fi
fi

# 4) Ensure CSP_TROUBLESHOOTING.md warns about not weakening production CSP
if [ -f CSP_TROUBLESHOOTING.md ]; then
  if grep -qi "Never add third-party domains to production CSP\|do not add third-party domains to production" CSP_TROUBLESHOOTING.md; then
    pass "CSP_TROUBLESHOOTING.md contains production-weakening warning."
  else
    fail "CSP_TROUBLESHOOTING.md lacks a clear warning about not weakening production CSP."
  fi
fi

# 5) Ensure TEST_VALIDATION.md is marked archived
if [ -f TEST_VALIDATION.md ]; then
  if head -n 2 TEST_VALIDATION.md | grep -iq "archiv"; then
    pass "TEST_VALIDATION.md is marked as archived."
  else
    fail "TEST_VALIDATION.md should be explicitly marked ARCHIVED at the top."
  fi
fi

# 6) Repo-wide search for stale script names or unsafe CSP directives
STALE_OCCURS=$(grep -RIn "test:integration\|lighthouse:security\|unsafe-inline\|unsafe-eval" . || true)
if [ -n "$STALE_OCCURS" ]; then
  echo "$STALE_OCCURS"
  fail "Found occurrences of stale script names or unsafe CSP directives. Ensure they are only in archived files."
else
  pass "No repo occurrences of stale script names or unsafe CSP directives (outside archived files)."
fi

# Final result
if [ "$ERRORS" -ne 0 ]; then
  echo "\nDocumentation verification completed: $ERRORS checks failed."
  exit 2
else
  echo "\nDocumentation verification completed: all checks passed."
  exit 0
fi
