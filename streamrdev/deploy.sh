#! /bin/bash
set -e

branch=${1:-origin/develop}

echo Stopping the dev environment...
~/dev-stack-stop.sh

echo Pulling branch $branch...
cd ~/logstore
git fetch
git checkout $branch

echo Building docker containers...
docker compose build

echo Starting the dev environment...
~/dev-stack-start.sh
