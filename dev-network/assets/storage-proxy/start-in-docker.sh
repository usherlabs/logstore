#!/bin/bash

CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    echo "-- First container startup. Let the validator node join the logstore network --"
    logstore --host http://sidechain:8546 --wallet $STORAGE_PROXY_PRIVATE_KEY storage-proxy init --metadata "$STORAGE_PROXY_METADATA" &&
    logstore --host http://sidechain:8546 --wallet $STORAGE_PROXY_PRIVATE_KEY storage-proxy join --node $STORAGE_PROXY_NODE_ADDRESS &&
    logstore --host http://sidechain:8546 --wallet $STORAGE_PROXY_NODE_PRIVATE_KEY query stake -y 1000000000000000000000000000000 --debug &&
    touch $CONTAINER_ALREADY_STARTED
else
    echo "-- Not first container startup, doing nothing.--"
fi
