#!/bin/bash
set -e

LOG=sidechain-build.log

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
  echo "Building logstore/smart-contracts-init docker image"
  docker build -t logstore/smart-contracts-init:dev -f ./Dockerfile.contracts ../

  echo "Starting Streamr sidechain"
  docker run \
    --rm \
    --detach \
    --name logstore-dev-parity-sidechain-node0 \
    --publish 8546:8540 \
    --env CHAIN_ID=0x2325 \
    streamr/open-ethereum-poa-sidechain-preload1:dev

  echo "waiting 5s for chain to start up"
  sleep 5

  echo "Starting smart contract init"
  docker run \
    --rm \
    --detach \
    --name logstore-dev-smart-contracts-init \
    logstore/smart-contracts-init:dev

  docker logs -f logstore-dev-smart-contracts-init 2>&1 | tee $LOG
  # docker logs -f logstore-dev-smart-contracts-init &> $LOG
  INITSTATUS=`docker wait logstore-dev-smart-contracts-init`
  echo "logstore-dev-smart-contracts-init finished with status $INITSTATUS. Logs in $LOG"
  docker exec logstore-dev-parity-sidechain-node0 /bin/bash -c 'rm -rf /home/parity/parity_data.default'
  docker exec logstore-dev-parity-sidechain-node0 /bin/bash -c 'mv /home/parity/parity_data /home/parity/parity_data.default'

  echo "Committing LogStore sidechain image locally"
  docker commit logstore-dev-parity-sidechain-node0 logstore/open-ethereum-poa-sidechain-preload1:dev
  echo "Stopping Streamr sidechain"
  docker stop logstore-dev-parity-sidechain-node0
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network build -l
fi
