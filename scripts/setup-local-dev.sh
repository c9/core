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
esac
case "$uname" in
    *x86_64*) arch=x64 ;;
    *i*86*) arch=x86 ;;
    *armv6l*) arch=arm-pi ;;
    *armv7l*) arch=arm-pi ;;
esac


cd `dirname $0`/..
SOURCE=`pwd`

LOCAL=$SOURCE/local
APPDIR=$SOURCE/build/webkitbuilds/app.nw


if [ "$os" == "darwin" ]; then
    if [ ! -d $SOURCE/build/webkitbuilds/cache/mac/0.9.3 ]; then
        mkdir -p $SOURCE/build/webkitbuilds/cache/mac/0.9.3/node-webkit.app
        pushd $SOURCE/build/webkitbuilds/cache/mac/0.9.3
        curl -OL http://dl.node-webkit.org/v0.9.3/node-webkit-v0.9.3-pre8-osx-ia32.zip
        unzip node-webkit-v0.9.3-pre8-osx-ia32.zip
        popd
    fi
    
    DEST="$SOURCE/build/Cloud9-dev.app"
    RES="$DEST/Contents/Resources"
    
    rm -rf "$DEST"
    mkdir -p "$RES/app.nw"
    
    cp -R $SOURCE/build/webkitbuilds/cache/mac/0.9.3/node-webkit.app/* $DEST
    cat $SOURCE/local/Info.plist | sed "s/Cloud9/Cloud9-dev/" >  $DEST/Contents/Info.plist
    # TODO add blue icon for dev mode
    # rm $DEST/Contents/Resources/nw.icns
    cp $SOURCE/build/osx/c9.icns $DEST/Contents/Resources/nw.icns
    
    node --eval "
        var path = require('path')
        var p = require('./local/package.json'); 
        p.main = path.relative('$RES/app.nw', '$SOURCE/local/projectManager.html');
        delete p.dependencies;
        // p.window.icon = 'icon.png';
        console.log(JSON.stringify(p, null, 2));
    " > $RES/app.nw/package.json
    
    echo dev app created in build/Cloud9-dev.app/Contents/MacOS/node-webkit
fi

if [ "$os" == "windows" ]; then
    NODE_VERSION=v0.10.25
    NW_VERSION=v0.9.2
    
    pushd build
    if [ ! -f node.exe ]; then
        echo "downloading node"
        curl -OL http://nodejs.org/dist/$NODE_VERSION/node.exe
    fi
    if [ ! -f node-webkit-$NW_VERSION-win-ia32.zip ]; then
        echo "downloading node-webkit"
        curl -OL http://dl.node-webkit.org/$NW_VERSION/node-webkit-$NW_VERSION-win-ia32.zip
    fi
    
    dest=win32-dev/bin
    mkdir -p $dest
    
    unzip node-webkit-$NW_VERSION-win-ia32.zip -d $dest
    cp node.exe $dest
    mv $dest/nw.exe $dest/Cloud9.exe
    
    cp win32/icon.png $dest
    
    # cp -Rf win32/deps win32/bin/deps
    
    node --eval '
        var p=require("../local/package.json"); 
        p.main = "../../../local/projectManager.html";
        delete p.dependencies;
        p.window.icon = "icon.png";
        console.log(JSON.stringify(p, null, 2));
    ' > $dest/package.json

    popd
fi



