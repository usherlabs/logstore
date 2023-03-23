CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED
    echo "-- First container startup, waiting 30sec, then deploying contracts --"
    sleep 30s; npx hardhat run ./scripts/0_deployNodeManager.ts --network streamr-dev-docker
else
    echo "-- Not first container startup, doing nothing.--"
fi