#!/usr/bin/env bash

set -e

# this script should run to avoid package.json install errors, because this package is non existant at the time first install
# get the path of this very script
SCRIPT_PATH="$( cd "$(dirname "$0")" ; pwd -P )"
SCRIPT_DIR=$(basename $SCRIPT_PATH)

# - check if pkg/package.json exists

cd $SCRIPT_PATH

# if it doesn't exist, create it
if [ ! -f "./pkg/package.json" ]; then
	# - create pkg/package.json with name = same name of this directory, creating the path if it doesn't exist
	mkdir -p pkg
	echo "{\"name\": \"$SCRIPT_DIR\"}" > pkg/package.json
fi
