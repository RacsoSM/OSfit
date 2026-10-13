#!/bin/bash
# SessionStart hook (solo sesiones remotas de Claude Code): instala graphify
# y su skill. NO regenera el grafo: eso solo se hace cuando el usuario lo pide
# explícitamente (ver la regla de oro en CLAUDE.md).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if ! command -v graphify >/dev/null 2>&1; then
  pip install --quiet graphifyy >&2
fi

if [ ! -d "$HOME/.claude/skills/graphify" ]; then
  graphify install --platform claude >&2
fi

msg="REGLA DE ORO: este proyecto tiene un grafo de graphify en graphify-out/graph.json. Para investigar cualquier contexto del proyecto, consulta primero el grafo (graphify query / skill graphify) antes de usar Grep, Glob, Read o Explore."
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
