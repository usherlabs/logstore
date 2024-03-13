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
  # Pulling the very specific images by theri digests:
  # That have to be removed when LogStore dev network gets updated to be compatible with the original streamr dev network.

  # streamr/broker-node:dev
  # docker pull streamr/broker-node@sha256:6f55db912e10d4ee6b8d1c82ab4101b0671c5e2714ed4bd90d03558fe156a904
  # docker tag streamr/broker-node@sha256:6f55db912e10d4ee6b8d1c82ab4101b0671c5e2714ed4bd90d03558fe156a904 streamr/broker-node:dev

  # streamr/stream-metrics-index:latest
  # docker pull streamr/stream-metrics-index@sha256:70ff5305a153e8ed25c9a0c10be5edccd0bce16738cb6b2aa84330989e7d33df
  # docker tag streamr/stream-metrics-index@sha256:70ff5305a153e8ed25c9a0c10be5edccd0bce16738cb6b2aa84330989e7d33df streamr/stream-metrics-index:latest

	# ^ Moved to streamr-docker-dev repo in docker-compose.yaml

  streamr-docker-dev start

  cd $DEV_NETWORK_DIR
    docker compose up --build -d
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network start -l
fi
