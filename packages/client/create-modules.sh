#!/bin/bash

rm -rf modules .streamr-network
git clone git@github.com:usherlabs/streamr-network.git ./.streamr-network
cd ./.streamr-network
npm i
cd ./packages/client
npm i
bash ./vendor-hack.sh
cd ../../../
mkdir -p ./modules/streamr/client
mkdir -p ./modules/streamr/network-node
mkdir -p ./modules/streamr/protocol
cp -R ./.streamr-network/packages/client/package.json ./modules/streamr/client/package.json
cp -R ./.streamr-network/packages/client/src ./modules/streamr/client/src
cp -R ./.streamr-network/packages/client/vendor ./modules/streamr/client/vendor
cp -R ./.streamr-network/packages/network/src ./modules/streamr/network-node/src
cp -R ./.streamr-network/packages/protocol/src ./modules/streamr/protocol/src
