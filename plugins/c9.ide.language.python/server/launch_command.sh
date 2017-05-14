#!/usr/bin/env bash
# Helper script to launch jedi/pylint in a python2/3 virtualenv
set -e

PYTHON=$1
COMMAND=$2

SHAREDENV="/mnt/shared/lib/$PYTHON"
FALLBACKENV="$HOME/.c9/$PYTHON"

if [[ -d $SHAREDENV ]]; then
    ENV=$SHAREDENV
    source $ENV/bin/activate
    PYTHON="$ENV/bin/$PYTHON"
elif which virtualenv &>/dev/null; then
    ENV=$FALLBACKENV
    if ! [[ -d $ENV ]]; then
        VERSION=
        if [ "$PYTHON" = "python3" ]; then
            VERSION=--python=python3
        fi
        virtualenv $VERSION $ENV
    fi

    source $ENV/bin/activate

    if ! python -c 'import jedi' &>/dev/null; then
        echo "Installing python support dependencies" >&2
        pip install --upgrade jedi pylint pylint-flask pylint-django >&2
    fi

    PYTHON=$ENV/bin/$PYTHON
else
    echo "Python support fatal error: virtualenv not installed" >&2
    echo "try 'pip install virtualenv' or 'sudo pip install virtualenv'" >&2
    exit 1
fi

COMMAND=${COMMAND/\$PYTHON/$PYTHON}
COMMAND=${COMMAND/\$ENV/$ENV}
eval "$COMMAND"