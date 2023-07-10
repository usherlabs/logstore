#!/bin/bash

CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED
    echo "-- First container startup. Let the validator node join the logstore network --"
    logstore --host http://sidechain:8546 --wallet $EVM_PRIVATE_KEY query stake -y 1000000000000000000000000000000
    node ./cli/index.js
else
    echo "-- Not first container startup. Starting the validator node --"
    logstore-validator start \
        --pool 0 \
        --valaccount VALACCOUNT \
        --storage-priv STORAGE_PRIV \
        --chain-id kyve-local \
        --rpc http://logstore-kyve:26657 \
        --rest http://logstore-kyve:1317
fi
