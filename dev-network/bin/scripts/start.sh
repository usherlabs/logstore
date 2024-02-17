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
  # Pull a very specific image streamr/broker-node:dev by its digest.
  # That have to be removed when we update to be compatible with the original streamr dev network.
  docker pull streamr/broker-node@sha256:6f55db912e10d4ee6b8d1c82ab4101b0671c5e2714ed4bd90d03558fe156a904
  docker tag streamr/broker-node@sha256:6f55db912e10d4ee6b8d1c82ab4101b0671c5e2714ed4bd90d03558fe156a904 streamr/broker-node:dev

  streamr-docker-dev start

  cd $DEV_NETWORK_DIR
    docker compose up --build -d
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network start -l
fi
