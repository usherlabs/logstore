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
  streamr-docker-dev start --wait

  cd $DEV_NETWORK_DIR
  docker compose up -d
else
  ssh dev-network dev-network start -l
fi
