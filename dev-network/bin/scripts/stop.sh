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
  streamr-docker-dev wipe
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network stop -l
fi
