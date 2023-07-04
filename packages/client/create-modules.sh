#!/bin/bash

if [ -d "$DIR" ];
then
	echo "Log Store: Streamr Client Module is loaded. Producing client package modules..."
else
	echo "$DIR does not exist. Please use 'pnpm modules' from root directory."
	exit;
fi

rm -rf ./modules
mkdir -p ./modules/streamr/client
mkdir -p ./modules/streamr/network-node
mkdir -p ./modules/streamr/protocol
cp -R ./.streamr-network/packages/client/package.json ./modules/streamr/client/package.json
cp -R ./.streamr-network/packages/client/src ./modules/streamr/client/src
cp -R ./.streamr-network/packages/client/vendor ./modules/streamr/client/vendor
# cp -R ./.streamr-network/packages/network/tsconfig.node.json ./modules/streamr/network-node/tsconfig.node.json
cp -R ./.streamr-network/packages/network/src ./modules/streamr/network-node/src
# cp -R ./.streamr-network/packages/protocol/tsconfig.node.json ./modules/streamr/protocol/tsconfig.node.json
cp -R ./.streamr-network/packages/protocol/src ./modules/streamr/protocol/src

echo "Log Store: Client package modules successfully created."
