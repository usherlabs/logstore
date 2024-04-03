#!/bin/bash

ip_lines=$(/sbin/ifconfig | grep -c 10.200.10.1)
if [ "$ip_lines" -eq "0" ]; then
    echo "Binding the internal IP address 10.200.10.1 to the loopback interface."
    echo "This requires sudo privileges, so please provide your password if requested"

    # Binding the loopback address is OS-specific
    case "$OSTYPE" in
    darwin*)
        sudo ifconfig lo0 alias 10.200.10.1/24
    ;;
    linux*)
        sudo ip addr add 10.200.10.1 dev lo label lo:1
    ;;
    msys*|cygwin*) # windows
        echo "It is required to bind a loopback interface manually on Windows."
        echo "Please follow the links below for instructions on how to do it:"
        echo "https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/install-microsoft-loopback-adapter"
        echo "https://academy.showcockpit.com/tutorials/networking/loopback-network-adapter"
        exit 1
    ;;
    *)
        echo "streamr-docker-dev: unknown operating system: $OSTYPE" 1>&2
        exit 1
    ;;
    esac
fi

source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh

printf "
Connecting to the DevNetwork...

\thttp://10.200.10.1:80\t\t\tStreamr APP
\thttp://10.200.10.1:8802\t\t\tEVM Explorer

... Many other ports connected - See ./dev-network/bin/scripts/connect.sh

Keep the script running.
Hit [Ctrl+C] to abort.
"

$SSH \
	-o ServerAliveInterval=60 \
  -N \
  -L *:80:10.200.10.1:80 \
  -L *:443:10.200.10.1:443 \
  -L *:1317:10.200.10.1:1317 \
  -L *:4001:10.200.10.1:4001 \
  -L *:5432:10.200.10.1:5432 \
  -L *:7771:10.200.10.1:7771 \
  -L *:7772:10.200.10.1:7772 \
  -L *:7773:10.200.10.1:7773 \
  -L *:8000:10.200.10.1:8000 \
  -L *:8081:10.200.10.1:8081 \
  -L *:8545:10.200.10.1:8545 \
  -L *:8546:10.200.10.1:8546 \
  -L *:8547:10.200.10.1:8547 \
  -L *:8800:10.200.10.1:8800 \
  -L *:8801:10.200.10.1:8801 \
  -L *:8802:10.200.10.1:8802 \
  -L *:9042:10.200.10.1:9042 \
  -L *:26657:10.200.10.1:26657 \
  -L *:40401:10.200.10.1:40401 \
  -L *:40402:10.200.10.1:40402 \
  -L *:40403:10.200.10.1:40403 \
  -L *:40500:10.200.10.1:40500 \
  -L *:40801:10.200.10.1:40801 \
  -L *:40802:10.200.10.1:40802 \
  -L *:40803:10.200.10.1:40803
