#! /bin/bash
set -e

branch=${1:-origin/develop}

echo Stopping LogStore DevNetwork...
./stop.sh

echo Pulling branch $branch...
cd ~/logstore
git fetch
git checkout $branch

echo Building docker containers...
docker compose build

echo Starting LogStore DevNetwork...
./start.sh
