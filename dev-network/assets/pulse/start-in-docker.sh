#!/bin/bash

CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    echo "-- First container startup, waiting 30sec --"
    logstore-pulse init 1000000000000000000000000000000 &&
    touch $CONTAINER_ALREADY_STARTED
else
    echo "-- Not first container startup. Starting Pulse --"
    logstore-pulse start
fi
