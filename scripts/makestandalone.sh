#!/bin/bash -e
CONFIG="default"
while [ "$1" ]; do
  case "$1" in
    --config)
      shift
      CONFIG=$1
      ;;
    --compress)
      COMPRESS_OPTION="--compress"
      ;;
    --obfuscate)
      OBFUSCATE_OPTION="--obfuscate"
      ;;
    --copy-static-resources)
      COPY_STATICS_OPTION="--copy-static-resources"
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
CDN="$CURDIR/../server.js cdn-cli -s standalone --server-config standalone --server-settings standalone
  --version=standalone --cache $CACHE $COMPRESS_OPTION $OBFUSCATE_OPTION $COPY_STATICS_OPTION"

# build async loaded ace modules
$CDN --module ace

WORKER=plugins/c9.ide.language.core/worker
echo building worker $WORKER
$CDN --worker $WORKER
echo $CDN --worker $WORKER

echo building config $CONFIG
$CDN --config $CONFIG --with-skins
