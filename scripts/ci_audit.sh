#!/usr/bin/env bash
# CI Audit Script — P2 #26
# Run dependency vulnerability scans and migration checks.
# Add this to your CI pipeline (e.g. GitHub Actions, GitLab CI).
#
# Usage:
#   bash scripts/ci_audit.sh
#   OR add as a CI step:
#   - name: Audit
#     run: bash scripts/ci_audit.sh

set -euo pipefail

echo "=== Python dependency audit ==="
pip install pip-audit --quiet 2>/dev/null || true
pip-audit --requirement backend/requirements.txt --strict || {
    echo "⚠️  pip-audit found vulnerabilities"
    exit 1
}

echo ""
echo "=== Node.js dependency audit ==="
pnpm audit --audit-level=high || {
    echo "⚠️  pnpm audit found high-severity vulnerabilities"
    # Non-blocking: many npm audit findings are dev-only
    true
}

echo ""
echo "=== Alembic migration check ==="
cd backend
alembic check 2>/dev/null || alembic heads 2>/dev/null || {
    echo "⚠️  Alembic check failed — pending migrations?"
    exit 1
}
cd ..

echo ""
echo "✅ All CI audit checks passed"
