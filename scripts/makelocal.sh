#!/bin/bash -e

while [ "$1" ]; do
  case "$1" in
    --compress)
      COMPRESS_OPTION="--compress"
      ;;
    --obfuscate)
      OBFUSCATE_OPTION="--obfuscate"
      ;;
    --quick)
      QUICK="1"
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done


cd `dirname $0`
CURDIR=`pwd`
CACHE=../build

#CDN="echo server.js cdn-cli"
CDN_SETTINGS="cdn-cli --server-settings standalone --server-config standalone"
CDN="../server.js $CDN_SETTINGS --settings local --version=standalone --cache $CACHE $COMPRESS_OPTION $OBFUSCATE_OPTION"

mkdir -p "$CACHE/standalone/modules/lib/emmet"
cp "$CURDIR/../node_modules/emmet/emmet.js" "$CACHE/standalone/modules/lib/emmet/"

WORKER=plugins/c9.ide.language.core/worker
echo building worker $WORKER
$CDN --worker $WORKER
echo $CDN --worker $WORKER

if [ "$QUICK" = "1" ]; then
  # build ace modules only if they are missing
  if [ ! -f ../build/standalone/modules/ace/mode/abap.js ]; then
    $CDN --module ace
  fi
  $CDN --config full --with-skins dark
  cp ../build/standalone/config/full.js ../build/standalone/config/default-local.js
  mkdir -p ../build/standalone/skin/default-local
  cp ../build/standalone/skin/full/* ../build/standalone/skin/default-local/
else
  # build async loaded ace modules
  $CDN --module ace
  
  # todo instead of creating file with full source create diff between default-local and full
  $CDN --config "default-local,full" --with-skins
fi