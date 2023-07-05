#!/bin/bash

DIR="$(pwd)/../../modules/streamr-network/packages"

rm -rf ./modules
if [ -d "$DIR" ];
then
	echo "Log Store: 'streamr-network' submodule is loaded! Copying source files to modules..."
	mkdir -p ./modules/streamr
	cp -R "$DIR/client" ./modules/streamr/client
	cp -R "$DIR/protocol" ./modules/streamr/protocol
	cp -R "$DIR/network" ./modules/streamr/network-node
	echo "Log Store: 'streamr-network' modules created!"
else
	echo "$DIR does not exist. Please use 'pnpm modules' or install Git Submodules from the Monorepo root directory."
	exit;
fi
