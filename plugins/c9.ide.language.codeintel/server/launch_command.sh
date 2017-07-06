#!/usr/bin/env bash
# Helper script to launch python with codeintel in a python2 virtualenv
set -e

COMMAND=$1

SHAREDENV="/mnt/shared/lib/python2"
FALLBACKENV="$HOME/.c9/python2"

if [[ -d $SHAREDENV/lib/python2.7/site-packages/codeintel ]]; then
    ENV=$SHAREDENV
else
    ENV=$FALLBACKENV
    if ! [[ -d $ENV ]]; then
        echo "!!Not installed" >&2
        exit 1
    fi
fi

source $ENV/bin/activate
PYTHON="$ENV/bin/python"

COMMAND=${COMMAND/\$PYTHON/$PYTHON}
COMMAND=${COMMAND/\$ENV/$ENV}
eval "$COMMAND"