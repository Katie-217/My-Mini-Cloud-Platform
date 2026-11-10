#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
docker compose -f docker-compose.yml -p mycloud stop
printf '%s\n' 'Stopped mycloud. Containers and named volumes are preserved.'
