#!/usr/bin/env bash
# Install caveman (https://github.com/JuliusBrussee/caveman) for Claude Code.
#
# Two paths:
#   1. If the `claude` CLI is present, install it as a proper plugin (hooks,
#      statusline, slash commands, skills, subagents).
#   2. Otherwise copy the skills / commands / subagents into ~/.claude
#      directly. No hooks, no statusline, but /caveman and friends work.
#
# Idempotent: safe to re-run.
set -euo pipefail

REPO="https://github.com/JuliusBrussee/caveman.git"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

if command -v claude >/dev/null 2>&1; then
  if claude plugin list 2>/dev/null | grep -q caveman; then
    echo "    caveman plugin already installed"
  else
    claude plugin marketplace add "$REPO"
    claude plugin install caveman@caveman
  fi
  exit 0
fi

echo "    claude CLI not found — installing caveman as user skills instead"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 --quiet "$REPO" "$TMP/caveman"

mkdir -p "$CONFIG_DIR/skills" "$CONFIG_DIR/commands" "$CONFIG_DIR/agents"
cp -R "$TMP/caveman/skills/." "$CONFIG_DIR/skills/"
cp "$TMP/caveman/commands/"*.md "$CONFIG_DIR/commands/"
cp "$TMP/caveman/agents/"*.md "$CONFIG_DIR/agents/"

echo "    installed skills: $(ls "$CONFIG_DIR/skills" | tr '\n' ' ')"
