#!/bin/sh
# Xcode Cloud post-clone hook for SkyFlag.
#
# Xcode Cloud builds run on a freshly-cloned repo, but our iOS app is a
# Capacitor wrapper around a Vite web build that lives outside Xcode's
# build pipeline. This script installs Node, builds the web app, and
# syncs the output into the iOS project so Xcode can archive against
# up-to-date web assets — and so the Capacitor SPM packages (which
# resolve via node_modules paths) actually exist on disk before SPM
# tries to find them.
#
# Apple looks for `ci_post_clone.sh` in a `ci_scripts` folder next to
# the .xcodeproj — i.e. ios/App/ci_scripts/ in this repo.

set -e

echo "→ Environment"
echo "  CI_PRIMARY_REPOSITORY_PATH = ${CI_PRIMARY_REPOSITORY_PATH:-(unset)}"
echo "  pwd = $(pwd)"
echo "  uname = $(uname -a)"

# Some Xcode Cloud images have Node preinstalled; others don't. Check
# first so we skip the brew install (and PATH dance) when it's there.
if command -v node >/dev/null 2>&1; then
  echo "→ Node already on PATH ($(node --version))"
else
  echo "→ Installing Node.js via Homebrew"
  brew install node
  # Apple-silicon brew lives at /opt/homebrew; Intel at /usr/local. Update
  # PATH for both so npm/npx are findable regardless of runner arch.
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

echo "→ Tool versions"
echo "  node = $(node --version)"
echo "  npm  = $(npm --version)"

# Xcode Cloud sets CI_PRIMARY_REPOSITORY_PATH to the repo root.
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "→ Working dir: $(pwd)"

echo "→ Installing JS dependencies (npm ci uses package-lock.json strictly)"
npm ci

echo "→ Building web app (Vite → dist/)"
npm run build

echo "→ Syncing web build into iOS Capacitor project"
npx cap sync ios

echo "→ Verifying Capacitor native packages landed in node_modules"
if [ ! -d node_modules/@capacitor/push-notifications ]; then
  echo "✗ @capacitor/push-notifications missing after npm ci"
  exit 1
fi

echo "✓ Web assets + node_modules ready — Xcode can archive now"
