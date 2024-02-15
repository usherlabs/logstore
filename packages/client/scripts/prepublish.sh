#!/usr/bin/env bash
# get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# get root directory
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd $ROOT_DIR

# copy file, creating parent directories if not exists
mkdir -p ./dist/wasm/tlsn-verify-rs/pkg
cp ./wasm/tlsn-verify-rs/pkg/tlsn_verify_rs_bg.wasm ./dist/wasm/tlsn-verify-rs/pkg/tlsn_verify_rs_bg.wasm
