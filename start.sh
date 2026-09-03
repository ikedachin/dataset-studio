#!/usr/bin/env bash
set -euo pipefail

# Always run from the project directory.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

exec uv run dataset-studio --host 127.0.0.1 --port 8765
