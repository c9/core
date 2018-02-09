#!/bin/bash -e

while [ "$1" ]; do
  case "$1" in
    --compress) COMPRESS=1 ;;
    --obfuscate) OBFUSCATE=1 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

uname="$(uname -a)"
os=
arch="$(uname -m)"
case "$uname" in
    Linux\ *) os=linux ;;
    Darwin\ *) os=darwin ;;
    SunOS\ *) os=sunos ;;
    FreeBSD\ *) os=freebsd ;;
    CYGWIN*) os=windows ;;
    MINGW*) os=windows ;;
    MSYS_NT*) os=windows ;;
esac
case "$uname" in
    *x86_64*) arch=x64 ;;
    *i*86*) arch=x86 ;;
    *armv6l*) arch=arm-pi ;;
    *armv7l*) arch=arm-pi ;;
esac

showStatus () { printf "\e[1A\e[0K\r%s\n" $1; }

cd `dirname $0`/..
SOURCE=`pwd`
export NODE_PATH=plugins/node_modules

APPDIR=$SOURCE/build/standalonebuild

# init
rm -Rf $APPDIR
rm -Rf $SOURCE/build/webkitbuilds/releases

# copy the C9 source into the package
mkdir -p $APPDIR
mkdir -p $APPDIR/bin
mkdir -p $APPDIR/build
mkdir -p $APPDIR/configs/ide
mkdir -p $APPDIR/plugins
mkdir -p $APPDIR/settings
mkdir -p $APPDIR/scripts
mkdir -p $APPDIR/node_modules

cp -a build/standalone $APPDIR/build
cp -a server.js $APPDIR

# bin
cp -a bin/c9 $APPDIR/bin

# configs
cp configs/standalone.js $APPDIR/configs
cp configs/cli.js $APPDIR/configs
cp configs/ide/default.js $APPDIR/configs/ide

# settings
cp settings/standalone.js $APPDIR/settings

# scripts
cp -a scripts/makest* $APPDIR/scripts


node -e " 
    require('c9/setup_paths');
    require('amd-loader');
    var fs = require('fs');
    var path = require('path');
    var copy = require('architect-build/copy');
    
    function pluginDirs(plugins) {
        var map = Object.create(null);
        plugins.forEach(function(p) {
            p = p.packagePath || p;
            if (typeof p === 'string')
                map[path.dirname(p)] = 1;
        });
        return Object.keys(map);
    }

console.log('Client Plugins:');
    var plugins = require('./configs/ide/default')(require('./settings/standalone')());
    copy.dirs('$SOURCE', '$APPDIR', pluginDirs(plugins), {
        include: /^(libmarkdown.js|loading(-flat)?.css|runners_list.js|builders_list.js)$/,
        exclude: /\\.(js|css|less|xml)$|^mock$/,
        onDir: function(e) { console.log('\x1b[1A\x1b[0K' + e) }
    });
    
console.log('CLI Plugins:');
    plugins = require('./configs/cli')();
    copy.dirs('$SOURCE', '$APPDIR', pluginDirs(plugins), {
        exclude: /^mock$/,
    });

console.log('Node Modules:');
    require('architect-build/npm_build')({
        root: '.',
        dest: '$APPDIR',
        args: [],
        ignore: /^(pty.js)$|c9.ide.language.jsonalyzer/
    }, function(err, result) {
        var deps = result.roots;
        // add client plugins
        deps.push('node_modules/rusha', 'node_modules/nak', 'node_modules/tern', 'node_modules/tern_from_ts');
        deps = deps.filter(function(x){
            if (!require('fs').statSync(x).isDirectory())
                return false;
            return true;
        });
        // console.log(deps)
        copy.dirs('$SOURCE', '$APPDIR', deps, {
            include: null,
            exclude: /^(mock|tests?|examples?|samples|Readme.*|build|dist|\.(idea|grunt|jshintrc|npmignore|gitignore|travis.yml))$/i
        });
    });
"

# add package.json
node -e "p=require('./package.json'); p.name = 'Cloud9'; p.revision = '$(git rev-parse HEAD)'; console.log(JSON.stringify(p, null, 2));" > $APPDIR/package.json


# remove unneeded files
rm -f $APPDIR/plugins/c9.vfs.server/vfs.connect.hosted*
rm -f $APPDIR/plugins/c9.vfs.server/last_access.js
rm -f $APPDIR/plugins/c9.vfs.server/registry.js

cp $SOURCE/plugins/c9.connect.favicon/favicon.ico $APPDIR

# remove debug symbols
cat $SOURCE/settings/standalone.js | sed "s/packed: false,/packed: true,/" | sed "s/collab: true,/collab: false,/" > $APPDIR/settings/standalone.js

# set version
date +%s > $APPDIR/version

# compress
if [ "$COMPRESS" ]; then
    if [ "$OBFUSCATE" ]; then
        OPTS="{ obfuscate: true }"
    else
        OPTS=""
    fi
    node -e "require('architect-build/compress_folder')('$APPDIR', '$OPTS')"
fi
