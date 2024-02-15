#!/usr/bin/env bash

set -e

# go to script directory
cd $(dirname $0)

../wasm/tlsn-verify-rs/before-install.sh
