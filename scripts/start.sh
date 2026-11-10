#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
python3 scripts/init-env.py
python3 scripts/preflight.py
docker compose -f docker-compose.yml -p mycloud build
docker compose -f docker-compose.yml -p mycloud up -d --no-build
python3 scripts/health-check.py --wait 180 "$@"
