#!/bin/bash

ROOT=$(pwd)
STREAMR_MONOREPO=../../modules/streamr-network
ARWEAVE_JS=../../modules/arweave-js

cd "${ROOT}/${STREAMR_MONOREPO}"
npm i
cd ./packages/client
npm i
bash ./vendor-hack.sh
cd "${ROOT}/${ARWEAVE_JS}"
npm i
npm build
