#!/usr/bin/env bash

common_help() {
echo "
dev-network – Streamr Docker Developer Environment.

Usage: dev-network [<command> [options]

Commands:
    help                show this screen
    config              config connection to the DevNetwork
    deploy              deploy the DevNetwork from a remote git branch
    tunnel              tunnel the required ports from the DevNetwork
    start               start the DevNetwokr
    stop                stop the DevNetwork
    restart             stop and start the DevNetwork
Examples:
    dev-network start
    dev-network stop
    dev-network deploy origin/develop

Show command-specific options:
	dev-network help <command>
"
}

config_help() {
echo "
NOT IMPLEMENTED YET
"
}

start_help() {
echo "
Starts the DevNetwork.

Usage: dev-network start
"
}

stop_help() {
echo "
Stops the DevNetwork.

Usage: dev-network stop
"
}

restart_help() {
echo "
Restarts the DevNetwork

Usage: dev-network restart
"
}

deploy_help() {
echo "
Deploys the DevNotwork from the the given remote git branch

Usage: dev-network deploy <branch>

Examples:
    dev-network deploy origin/develop
"
}

tunnel_help() {
echo "
Tunnels the required ports from the DevNetwork ot the local machine

Usage: dev-network tunnel
"
}

echo "HELP ROOT_DIR: $ROOT_DIR"

case $1 in
"" )
    common_help
    ;;
"setup" )
    config_help
    ;;
"start" )
    start_help
    ;;
"stop" )
    stop_help
    ;;
"restart" )
    restart_help
    ;;
"deploy" )
    deploy_help
    ;;
"tunnel" )
    tunnel_help
    ;;
* )
    common_help
    echo "ERROR: No help available for invalid command: $1"
    exit 1
    ;;
esac
