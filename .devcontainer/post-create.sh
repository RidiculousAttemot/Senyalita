#!/usr/bin/env bash
# Runs once when the codespace / devcontainer is created.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> npm dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> python dependencies"
if [ -f requirements.txt ]; then
  pip install --user -r requirements.txt
fi

echo "==> caveman"
bash .devcontainer/install-caveman.sh

echo "==> ready"
