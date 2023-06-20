#!/bin/bash

CONFIG_DIR=~/.dev-network
CONFIG_FILE=$CONFIG_DIR/config

set () {
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh

  while getopts ":i:u:f:" option; do
    case $option in
      i)
         DEV_NETWORK_IP=$OPTARG
         ;;
      u)
         DEV_NETWORK_USER_NAME=$OPTARG
         ;;
      f)
         DEV_NETWORK_USER_IDENTITY_FILE=$OPTARG
         ;;
     \?) # Invalid option
         echo "Error: Invalid option"
         exit;;
    esac
  done

  source $DEV_NETWORK_SCRIPTS_DIR/config_save.sh
}

show () {
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  echo "IP: $DEV_NETWORK_IP"
  echo "USER: $DEV_NETWORK_USER_NAME"
  echo "IDENTITY_FILE: $DEV_NETWORK_USER_IDENTITY_FILE"
}

OPERATION=$1
shift

case $OPERATION in
"" | help )
    "$DEV_NETWORK_SCRIPTS_DIR/help.sh" config
    ;;
set )
    set $@
    ;;
show )
    show
    ;;
* )
    "$DEV_NETWORK_SCRIPTS_DIR/help.sh" config
    echo "ERROR: Invalid command: $OPERATION"
    exit 1
    ;;
esac
