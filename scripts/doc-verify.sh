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

# 1) Check active docs for removed commands
ACTIVE_DOCS="README.md ROADMAP.md GETTING_STARTED.md DEPLOYMENT.md"
STALE_DOCS=""
for doc in $ACTIVE_DOCS; do
  if [ -f "$doc" ] && grep -E "test:integration|lighthouse:security" "$doc" >/dev/null 2>&1; then
    STALE_DOCS="$STALE_DOCS $doc"
  fi
done
if [ -n "$STALE_DOCS" ]; then
  echo ""
  fail "Docs reference removed scripts (test:integration or lighthouse:security):$STALE_DOCS"
else
  pass "Active docs contain no removed script references."
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
  VERCEL_CSP=$(jq -r '.headers[]?.headers[] | select(.key=="Content-Security-Policy").value' vercel.json)

  # Extract full CSP value lines from DEPLOYMENT.md: must contain the actual
  # policy (starts with default-src) and not be a truncated "..." example.
  DOC_CSP_LINES=$(grep "Content-Security-Policy" DEPLOYMENT.md | grep "default-src" | grep -v '\.\.\.' || true)

  if [ -z "$DOC_CSP_LINES" ]; then
    fail "DEPLOYMENT.md has no full CSP value to compare against vercel.json."
  else
    MISMATCH=0
    while IFS= read -r line; do
      VALUE=$(echo "$line" | sed -E 's/^[^"]*"(.*)"[^"]*$/\1/')
      if [ "$VALUE" != "$VERCEL_CSP" ]; then
        echo "--- Mismatched line in DEPLOYMENT.md ---"
        echo "$line"
        MISMATCH=1
      fi
    done <<< "$DOC_CSP_LINES"

    if [ "$MISMATCH" -eq 1 ]; then
      echo "--- vercel.json CSP ---"
      echo "$VERCEL_CSP"
      fail "CSP in DEPLOYMENT.md does not match vercel.json."
    else
      pass "CSP in DEPLOYMENT.md matches vercel.json."
    fi
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

# 6) Verify the canonical production CSP's script-src hasn't regressed to unsafe-inline/unsafe-eval
# Note: style-src 'unsafe-inline' is an intentional, documented residual (MUI/Emotion, S2
# hardening) and 'wasm-unsafe-eval' is required for self-hosted OCR WASM - neither should
# trip this check. Only a bare 'unsafe-inline' / 'unsafe-eval' in script-src is a regression.
# DEV_SECURITY_HEADERS (dev-server-only CSP in securityHeaders.ts) intentionally relaxes
# script-src and is out of scope - this checks the production CSP (vercel.json) only.
if [ -n "${VERCEL_CSP:-}" ]; then
  SCRIPT_SRC=$(echo "$VERCEL_CSP" | grep -o "script-src[^;]*" || true)
  CLEANED=$(echo "$SCRIPT_SRC" | sed "s/'wasm-unsafe-eval'//g")
  if echo "$CLEANED" | grep -qE "unsafe-inline|unsafe-eval"; then
    fail "Production CSP script-src contains unsafe-inline/unsafe-eval (beyond wasm-unsafe-eval): $SCRIPT_SRC"
  else
    pass "Production CSP script-src stays free of unsafe-inline/unsafe-eval (beyond wasm-unsafe-eval)."
  fi
else
  pass "Skipped script-src regression check (vercel.json CSP not found)."
fi

# 7) Repo-wide search for stale references to removed scripts
STALE_OCCURS=$(grep -RIn "test:integration\|lighthouse:security" \
  --exclude-dir=node_modules --exclude-dir=graphify-out --exclude-dir=.git \
  --exclude=doc-verify.sh . || true)
if [ -n "$STALE_OCCURS" ]; then
  echo "$STALE_OCCURS"
  fail "Found repo occurrences of removed script names (test:integration/lighthouse:security)."
else
  pass "No repo occurrences of removed script names (test:integration/lighthouse:security)."
fi

# Final result
if [ "$ERRORS" -ne 0 ]; then
  echo "\nDocumentation verification completed: $ERRORS checks failed."
  exit 2
else
  echo "\nDocumentation verification completed: all checks passed."
  exit 0
fi
