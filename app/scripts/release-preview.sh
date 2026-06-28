#!/usr/bin/env bash
#
# Publishes an OTA to the `preview` EAS channel — the pre-prod staging gate.
#
# A device running a `preview`-profile build picks this up. Validate the
# change there, THEN promote the same commit to production with
# release-prod.sh. The preview and production channels share one Supabase
# project, so this isolates the JS bundle, NOT the data (see docs/release.md).
#
# Usage:
#   ./scripts/release-preview.sh "Short message"            # OTA to preview (the recurring action)
#   ./scripts/release-preview.sh --with-build "Short msg"   # also cut a fresh preview binary
#                                                           # (one-time device setup, or after native changes)
#
# As with prod, the OTA bundles whatever is on disk at this commit.

set -euo pipefail

WITH_BUILD=false
if [[ "${1:-}" == "--with-build" ]]; then
  WITH_BUILD=true
  shift
fi

MESSAGE="${1:-}"
if [[ -z "$MESSAGE" ]]; then
  echo "Usage: $0 [--with-build] \"Short message\""
  echo "Example: $0 \"Trip Planning M1 Wk1 — lists CRUD + offline queue\""
  exit 1
fi

# Run from app/ regardless of invocation directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# EAS bundles the working tree as-is — warn on uncommitted changes.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠  Working tree has uncommitted changes:"
  git status --short
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

COMMIT="$(git rev-parse --short HEAD)"

if [[ "$WITH_BUILD" == true ]]; then
  echo "› Building iOS preview binary (commit $COMMIT) — install once on the test device…"
  npx eas-cli build --platform ios --profile preview --non-interactive
fi

# Switching APP_ENV between preview/production publishes on the same machine can
# leave babel-preset-expo's transform cache pinning stale inlined EXPO_PUBLIC_*
# values (see CLAUDE.md / docs/release.md "Metro cache" pitfall). Wipe it so the
# preview bundle is built clean.
echo "› Wiping metro transform cache…"
rm -rf "${TMPDIR:-/tmp}/metro-cache" || true

echo "› Publishing OTA to the preview channel (commit $COMMIT)…"
npx eas-cli update --branch preview --platform ios --non-interactive --message "$MESSAGE"

echo ""
echo "› Done → preview channel (commit $COMMIT)."
echo "› Validate on the preview build, then promote the SAME commit to prod:"
echo "    ./scripts/release-prod.sh \"$MESSAGE\""
