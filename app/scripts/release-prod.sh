#!/usr/bin/env bash
#
# Builds a production iOS binary and publishes a matching OTA update to
# the production channel. The OTA has to match the build or expo-updates
# will happily serve stale JS on top of every new binary you ship.
#
# Usage:
#   ./scripts/release-prod.sh "Short release message"
#
# If the build fails, no OTA is published. If the build succeeds, the OTA
# is published against the same working tree / commit.

set -euo pipefail

MESSAGE="${1:-}"

if [[ -z "$MESSAGE" ]]; then
  echo "Usage: $0 \"Short release message\""
  echo "Example: $0 \"Fix paywall crash on iPad\""
  exit 1
fi

# Run from the app/ directory regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Sanity: warn if the working tree has uncommitted changes. EAS bundles
# whatever is on disk — uncommitted changes will ship, for better or worse.
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

echo "› Building iOS production binary (commit $COMMIT) — this takes ~15 min…"
npx eas-cli build --platform ios --profile production --non-interactive

echo ""
echo "› Build finished. Publishing matching OTA to production channel…"
npx eas-cli update --branch production --platform ios --non-interactive --message "$MESSAGE"

echo ""
echo "› Done. Binary + OTA published for commit $COMMIT."
echo "› Submit to App Store with: npx eas-cli submit --platform ios --latest"
