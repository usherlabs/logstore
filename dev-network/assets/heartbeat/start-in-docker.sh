#!/bin/bash

CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED
    echo "-- First container startup, waiting 30sec --"
    sleep 30s;
else
    echo "-- Not first container startup. Starting Heartbeat --"
    logstore-heartbeat
fi
