#!/bin/bash
set -e

streamr-docker-dev stop
docker compose -f ~/logstore/docker-compose.yml down -v
docker compose -f ~/streamr-docker-dev/docker-compose.yml down -v
