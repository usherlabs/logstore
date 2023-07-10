#!/bin/bash

DIR="$(pwd)/../../modules/streamr-network/packages"

if [ -d "$DIR" ];
then
	echo "Log Store: 'streamr-network' submodule is loaded!"
else
	echo "$DIR does not exist. Please use 'pnpm modules' or install Git Submodules from the Monorepo root directory."
	exit;
fi
