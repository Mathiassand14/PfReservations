#!/usr/bin/env bash
set -euo pipefail

# Wrapper to launch the MarkItDown MCP server. Prefers `uvx` if present, falls back to PATH binary.

CMD=${CMD:-markitdown-mcp}

if command -v uvx >/dev/null 2>&1; then
  exec uvx "${CMD}" "$@"
elif [ -x "$HOME/.local/bin/uvx" ]; then
  exec "$HOME/.local/bin/uvx" "${CMD}" "$@"
elif command -v "${CMD}" >/dev/null 2>&1; then
  exec "${CMD}" "$@"
else
  echo "Error: Cannot find '${CMD}' or 'uvx'. Install via 'pipx install mcp-markitdown' or set CMD to the entrypoint." >&2
  exit 127
fi
