#!/usr/bin/env bash

common_help() {
echo "
dev-network – LogStore Docker Developer Environment.

Usage: dev-network [<command> [options]]

Commands:
    help                show this screen
    config              сonfigure connection to the DevNetwork
    deploy              deploy the DevNetwork from a remote git branch
    connect             connect the required ports from the DevNetwork
    start               start the DevNetwork
    stop                stop the DevNetwork
    restart             stop and start the DevNetwork
Examples:
    dev-network start
    dev-network stop
    dev-network deploy origin/develop
    dev-network connect

Show command-specific options:
	dev-network help <command>
"
}

config_help() {
echo "
Configure connection to the DevNetwork.

Subcommands:
    set                 set connection configuration

        Options:
            -i <ip_address>         IP address of the remote server running the DevNetwork
            -u <user>               user name to login to the remote server over SSH
            -f <identity_file>      full path to the public key file to login to the remote server over SSH

    show                show connection configuration

Usage: dev-network config set -i 10.0.0.1 -u ubuntu -f /home/ubuntu/.ssh/id_rsa.pub
Usage: dev-network config show
"
}

start_help() {
echo "
Start the DevNetwork.

Usage: dev-network start
"
}

stop_help() {
echo "
Stop the DevNetwork.

Usage: dev-network stop
"
}

restart_help() {
echo "
Restart the DevNetwork.

Usage: dev-network restart
"
}

deploy_help() {
echo "
Deploy the DevNotwork from the the given remote git branch.

Usage: dev-network deploy <branch>

Examples:
    dev-network deploy origin/develop
"
}

connect_help() {
echo "
Connect to the DevNetwork with tunnelling the required ports to the local machine.

Usage: dev-network connect
"
}

case $1 in
"" )
    common_help
    ;;
"config" )
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
"connect" )
    connect_help
    ;;
* )
    common_help
    echo "ERROR: No help available for invalid command: $1"
    exit 1
    ;;
esac
