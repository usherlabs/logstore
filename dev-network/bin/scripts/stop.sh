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

  STREAMR_DOCKER_BIN=$(which streamr-docker-dev) # eg: /usr/local/bin/streamr-docker-dev
  STREAMR_DOCKER_BIN_REAL=$(readlink $STREAMR_DOCKER_BIN -f) # eg: /home/user/streamr-docker-dev/streamr-docker-dev/bin/streamr-docker-dev
  STREAMR_DOCKER_DIR=$(dirname $STREAMR_DOCKER_BIN_REAL/..) # eg: /home/user/streamr-docker-dev/streamr-docker-dev/..
  STREAMR_DOCKER_DIR=$(readlink $STREAMR_DOCKER_DIR -f) # eg: /home/user/streamr-docker-dev


  docker compose -f $STREAMR_DOCKER_DIR/docker-compose.yml down -v
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network stop -l
fi
