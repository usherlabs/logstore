#!/bin/bash

BIN_FILE="$(readlink "$0" -f)"
DEV_NETWORK_BIN_DIR=$(dirname "$BIN_FILE")

export DEV_NETWORK_DIR="$DEV_NETWORK_BIN_DIR/.."
export DEV_NETWORK_SCRIPTS_DIR="$DEV_NETWORK_BIN_DIR/scripts"

OPERATION=$1
shift

case $OPERATION in
"" | help )
    "$DEV_NETWORK_SCRIPTS_DIR/help.sh" $@
    ;;
config )
    "$DEV_NETWORK_SCRIPTS_DIR/config.sh" $@
    ;;
start )
    "$DEV_NETWORK_SCRIPTS_DIR/start.sh" $@
    ;;
stop )
    "$DEV_NETWORK_SCRIPTS_DIR/stop.sh" $@
    ;;
restart )
    "$DEV_NETWORK_SCRIPTS_DIR/restart.sh" $@
    ;;
deploy )
    "$DEV_NETWORK_SCRIPTS_DIR/deploy.sh" $@
    ;;
tunnel )
    "$DEV_NETWORK_SCRIPTS_DIR/tunnel.sh" $@
    ;;
* )
    "$DEV_NETWORK_SCRIPTS_DIR/help.sh"
    echo "ERROR: Invalid command: $OPERATION"
    exit 1
    ;;
esac