#!/bin/bash -e

: ${1:?Usage: condense.sh [--name name] [--plugin name]* [--def name]* [+extrafile.js]* [file.js]+}

NEWCLIENT_DIR=$(cd $(dirname $BASH_SOURCE)/../../..; pwd)
PLUGIN_DIR=$NEWCLIENT_DIR/plugins/c9.ide.language.javascript.tern

cd /

$NEWCLIENT_DIR/node_modules/tern/bin/condense \
  --plugin node \
  --plugin doc_comment \
  --plugin requirejs \
  --plugin component \
  --plugin $PLUGIN_DIR/util/path_fixer.js \
  --plugin $PLUGIN_DIR/worker/architect_resolver_tern_plugin.js \
   "$@"
