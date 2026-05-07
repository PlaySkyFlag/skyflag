#!/bin/sh
# Xcode Cloud post-clone hook for SkyFlag.
#
# Xcode Cloud builds run on a freshly-cloned repo, but our iOS app is a
# Capacitor wrapper around a Vite web build that lives outside Xcode's
# build pipeline. This script installs Node, builds the web app, and
# syncs the output into the iOS project so Xcode can archive against
# up-to-date web assets.
#
# Apple looks for `ci_post_clone.sh` in a `ci_scripts` folder next to
# the .xcodeproj — i.e. ios/App/ci_scripts/ in this repo.

set -e

echo "→ Installing Node.js via Homebrew"
# Homebrew is preinstalled on Xcode Cloud images; Node is not.
brew install node

# Xcode Cloud sets CI_PRIMARY_REPOSITORY_PATH to the repo root.
cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "→ Installing JS dependencies (npm ci uses package-lock.json strictly)"
npm ci

echo "→ Building web app (Vite → dist/)"
npm run build

echo "→ Syncing web build into iOS Capacitor project"
npx cap sync ios

echo "✓ Web assets ready — Xcode can now archive with the latest build"
