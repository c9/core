#!/bin/bash -e

while [ "$1" ]; do
  case "$1" in
    --compress)
      COMPRESS_OPTION="--compress"
      ;;
    --obfuscate)
      OBFUSCATE_OPTION="--obfuscate"
      ;;
    *)
      echo Unknown option: $1
      exit 1
      ;;
  esac
  shift
done

cd `dirname $0`
CURDIR=`pwd`

case `uname` in
    *CYGWIN*) CURDIR=`cygpath -w "$CURDIR"`;;
esac

CACHE=$CURDIR/../build

#CDN="echo server.js cdn-cli"
CDN="$CURDIR/../server.js cdn-cli -s standalone --server-config standalone --server-settings standalone --version=standalone --cache $CACHE $COMPRESS_OPTION $OBFUSCATE_OPTION"

# build async loaded ace modules
$CDN --module ace

WORKER=plugins/c9.ide.language.core/worker
echo building worker $WORKER
$CDN --worker $WORKER
echo $CDN --worker $WORKER
for CONFIG in "default"; do \
echo cdn
    echo building config $CONFIG
    $CDN --config $CONFIG --with-skins
done
