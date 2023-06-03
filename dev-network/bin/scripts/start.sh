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
  streamr-docker-dev start

  cd $DEV_NETWORK_DIR
    docker compose up --build -d
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network start -l
fi
