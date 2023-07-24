#!/bin/bash

CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    echo "-- First container startup. Let the broker node join the logstore network --"
    logstore-broker join 1000000000000000000000000000000 -y -m "$BROKER_METADATA" &&
    touch $CONTAINER_ALREADY_STARTED
else
    echo "-- Not first container startup. Starting the broker node --"
    logstore-broker start
fi
