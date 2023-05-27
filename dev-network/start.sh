#!/bin/bash
set -e

DEV_NETWORK_DIR="$( dirname -- "${BASH_SOURCE[0]}"; )";   # Get the directory name
DEV_NETWORK_DIR="$( realpath -e -- "$DEV_NETWORK_DIR"; )";    # Resolve its full path

streamr-docker-dev start --wait

docker compose -f "${DEV_NETWORK_DIR}/docker-compose.yml" up --build -d
