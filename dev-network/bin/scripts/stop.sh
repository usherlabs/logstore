#!/bin/bash
set -e

while getopts ":l" option; do
  case $option in
    l)
      LOCAL="yes"
      ;;
  esac
done

if [ -n "$LOCAL" ];
then
  cd $DEV_NETWORK_DIR

  docker compose down -v
  streamr-docker-dev stop
  docker compose -f ~/streamr-docker-dev/docker-compose.yml down -v
else
  ssh dev-network dev-network stop -l
fi
