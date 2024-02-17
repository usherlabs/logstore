#! /bin/bash
set -e

while getopts ":l" option; do
  case $option in
    l)
      LOCAL="yes"
      shift
      ;;
  esac
done

if [ -n "$LOCAL" ];
then
  BRANCH=${1:-develop}

  echo Stopping the DevNetwork...
  "$DEV_NETWORK_SCRIPTS_DIR/stop.sh" -l

  echo Pulling branch $BRANCH...
  cd "$DEV_NETWORK_DIR/.."
  git fetch
  git reset --hard
  git switch $BRANCH
  git pull 
  git submodule update

  echo Starting the DevNetwork...
  "$DEV_NETWORK_SCRIPTS_DIR/start.sh" -l
else
  source $DEV_NETWORK_SCRIPTS_DIR/config_load.sh
  $SSH dev-network deploy -l $@
fi
