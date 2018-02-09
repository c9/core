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

LOCAL=$SOURCE/local
APPDIR=$SOURCE/build/webkitbuilds/app.nw
LOCALCFG=configs/client-default-local.js

# init
rm -Rf $APPDIR
rm -Rf $SOURCE/build/webkitbuilds/releases

# copy the C9 source into the package
mkdir -p $APPDIR
mkdir -p $APPDIR/bin
mkdir -p $APPDIR/build
mkdir -p $APPDIR/configs
mkdir -p $APPDIR/plugins
mkdir -p $APPDIR/settings
mkdir -p $APPDIR/scripts
mkdir -p $APPDIR/node_modules

cp -a build/standalone $APPDIR/build
rm -Rf $APPDIR/build/standalone/static
cp -a $SOURCE/local $APPDIR
cp -a server.js $APPDIR

# bin
cp -a bin/c9 $APPDIR/bin

# configs
cp configs/standalone.js $APPDIR/configs
cp configs/local.js $APPDIR/configs
cp configs/cli.js $APPDIR/configs
cp configs/client-default.js $APPDIR/configs
cp configs/client-default-local.js $APPDIR/configs

# settings
cp settings/standalone.js $APPDIR/settings
cp settings/local.js $APPDIR/settings

# scripts
cp -a scripts/makest* $APPDIR/scripts
cp -a scripts/install-nw-pty.sh $APPDIR/scripts
cp -a scripts/checkforupdates.sh $APPDIR/scripts


node -e " 
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
    var plugins = require('./configs/client-default-local')(require('./settings/local')());
    // this isn't included in local config but is needed for loading remote projects
    plugins.push('plugins/c9.ide.collab/collab');
    copy.dirs('$SOURCE', '$APPDIR', pluginDirs(plugins), {
        include: /^(libmarkdown.js|loading.css|runners_list.js|builders_list.js)$/,
        exclude: /\\.(js|css|less|xml)$|^mock$/,
        onDir: function(e) { console.log('\x1b[1A\x1b[0K' + e) }
    });
    
console.log('CLI Plugins:');
    plugins = require('./configs/cli')().concat('plugins/c9.login.client/bootstrap')
    copy.dirs('$SOURCE', '$APPDIR', pluginDirs(plugins), {
        exclude: /^mock$/,
    });

console.log('Node Modules:');
    require('architect-build/npm_build')({
        root: '.',
        dest: './build/webkitbuilds/app.nw',
        args: ['local','-s', 'local'],
        ignore: /^(pty.js)$/
    }, function(err, result) {
        var deps = result.roots;
        // add client plugins
        deps.push('node_modules/rusha', 'node_modules/nak');
        deps = deps.filter(function(x){
            if (!require('fs').statSync(x).isDirectory())
                return false;
            return true;
        });
        copy.dirs('$SOURCE', '$APPDIR', deps, {
            include: null,
            exclude: /^(mock|tests?|examples?|samples|Readme.*|build|dist|LICENSE|\\.(idea|grunt|jshintrc|npmignore|gitignore|travis.yml))\$|_test\\.js/i
        });
    });

console.log('local:');
	['index.html', 'projectManager.html'].forEach(function(p) {
		copy.file('$LOCAL/' + p, '$APPDIR/local/' + p, function(source) {
			return source.replace(/\/[/*]::dev:(:.*|{[\s\S]*?\/[/*]::dev:}.*)/g, '');
		});
	});

"

# copy the local package json to the root
node -e "p=require('./local/package.json'); p.name = 'Cloud9'; p.main = 'local/projectManager.html'; p.revision = '$(git rev-parse HEAD)'; console.log(JSON.stringify(p, null, 2));" > $APPDIR/package.json

# remove unneeded files
rm $APPDIR/plugins/c9.vfs.server/vfs.connect.hosted*
rm $APPDIR/plugins/c9.vfs.server/last_access.js
rm $APPDIR/plugins/c9.vfs.server/registry.js

cp $SOURCE/plugins/c9.connect.favicon/favicon.ico $APPDIR

# remove debug symbols
cat $LOCALCFG | sed "s/options.debug *= .*/options.debug = false/" > $APPDIR/$LOCALCFG
cat $SOURCE/settings/local.js | sed "s/config.packed = false;/config.dev = false;config.packed = true;/" > $APPDIR/settings/local.js

# set version
date +%s > $APPDIR/version

# set nw version
NWVERSION=0.9.3
echo $NWVERSION > $APPDIR/nwversion

if [ "$COMPRESS" ]; then
    if [ "$OBFUSCATE" ]; then
        OPTS="{ obfuscate: true }"
    else
        OPTS="{}"
    fi
    node -e "require('architect-build/compress_folder')('$APPDIR', '$OPTS')"
fi




if [[ $os == "windows" ]]; then
    echo done!
elif [ $os == "darwin" ]; then
    if [ ! -d $SOURCE/build/webkitbuilds/cache/mac/$NWVERSION ]; then
        mkdir -p $SOURCE/build/webkitbuilds/cache/mac/$NWVERSION/node-webkit.app
        pushd $SOURCE/build/webkitbuilds/cache/mac/$NWVERSION
        curl -O http://dl.node-webkit.org/v$NWVERSION/node-webkit-v$NWVERSION-pre8-osx-ia32.zip
        unzip node-webkit-v$NWVERSION-pre8-osx-ia32.zip
        popd
    fi
    
    DEST="$SOURCE/build/webkitbuilds/releases/Cloud9/mac/Cloud9.app"
    RES="$DEST/Contents/Resources"
    
    rm -rf "$DEST"
    mkdir -p "$RES"
    
    cp -R $SOURCE/build/webkitbuilds/cache/mac/$NWVERSION/node-webkit.app/* $DEST
    
    cp -R "$SOURCE/build/webkitbuilds/app.nw" "$RES"
    
    # copy Infoplist
    cat $SOURCE/local/Info.plist >  $DEST/Contents/Info.plist
    # copy icons
    rm $DEST/Contents/Resources/nw.icns
    cp $SOURCE/build/osx/c9.icns $DEST/Contents/Resources/nw.icns
    # make cli executable
    chmod +x $RES/app.nw/bin/c9
else
    echo TODO
fi
