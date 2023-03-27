#!/bin/bash
set -e

streamr-docker-dev start --wait
docker compose -f ~/logstore/docker-compose.yml up
