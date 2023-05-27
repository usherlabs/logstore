#!/bin/bash
set -e

DEV_NETWORK_DIR="$( dirname -- "${BASH_SOURCE[0]}"; )";   # Get the directory name
DEV_NETWORK_DIR="$( realpath -e -- "$DEV_NETWORK_DIR"; )";    # Resolve its full path

streamr-docker-dev stop
docker compose -f "${DEV_NETWORK_DIR}/docker-compose.yml" down -v
docker compose -f ~/streamr-docker-dev/docker-compose.yml down -v
