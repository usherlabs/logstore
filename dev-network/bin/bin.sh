#!/bin/bash

BIN_FILE="$(readlink "$0" -f)"
export DEV_NETWORK_BIN_DIR=$(dirname "$BIN_FILE")
export DEV_NETWORK_DIR="$DEV_NETWORK_BIN_DIR/.."
export DEV_NETWORK_SCRIPTS_DIR="$DEV_NETWORK_BIN_DIR/scripts"

CONFIG_DIR=~/.dev-network
CONFIG_FILE=$CONFIG_DIR/config

OPERATION=$1
shift

case $OPERATION in
"" | help )
    source "$DEV_NETWORK_SCRIPTS_DIR/help.sh"
    ;;
config )
    source "$DEV_NETWORK_SCRIPTS_DIR/config.sh"
    ;;
start )
    source "$DEV_NETWORK_SCRIPTS_DIR/start.sh"
    ;;
stop )
    source "$DEV_NETWORK_SCRIPTS_DIR/stop.sh"
    ;;
restart )
    source "$DEV_NETWORK_SCRIPTS_DIR/stop.sh"
    source "$DEV_NETWORK_SCRIPTS_DIR/start.sh"
    ;;
deploy )
    source "$DEV_NETWORK_SCRIPTS_DIR/deploy.sh"
    ;;
connect )
    source "$DEV_NETWORK_SCRIPTS_DIR/connect.sh"
    ;;
* )
    source "$DEV_NETWORK_SCRIPTS_DIR/help.sh"
    echo "ERROR: Invalid command: $OPERATION"
    exit 1
    ;;
esac