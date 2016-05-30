#!/bin/bash -e

set -e

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


cd `dirname $0`/..
SOURCE=`pwd`

LOCAL=$SOURCE/local
APPDIR=$SOURCE/build/webkitbuilds/app.nw

if [ "$os" == "linux" ]; then
	if [ ! -d $SOURCE/build/webkitbuilds/cache/linux/0.12.3 ]; then
		mkdir -p $SOURCE/build/webkitbuilds/cache/linux/0.12.3/
		pushd $SOURCE/build/webkitbuilds/cache/linux/0.12.3
		wget http://dl.nwjs.io/v0.12.3/nwjs-v0.12.3-linux-x64.tar.gz
		tar -zxf nwjs-v0.12.3-linux-x64.tar.gz
		popd
	fi
	DEST="$SOURCE/build/Cloud9-dev-linux"
	rm -rf "$DEST"
	mkdir -p $DEST
	cp -R $SOURCE/build/webkitbuilds/cache/linux/0.12.3/nwjs-v0.12.3-linux-x64/* $DEST
	cp $SOURCE/build/linux/c9.png $DEST/icon.png

    node --eval "
        var path = require('path')
        var p = require('./local/package.json'); 
        p.main = path.relative('$DEST', '$SOURCE/local/projectManager.html');
        delete p.dependencies;
        p.window.icon = 'icon.png';
        console.log(JSON.stringify(p, null, 2));
    " > $DEST/package.json

fi

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
    NODE_VERSION=v0.12.2
    NW_VERSION=v0.12.2
    # TODO find a more reliable place to put c9 dependencies
    HOME="$HOMEDRIVE$HOMEPATH"
    pushd build
    if [ ! -f "$HOME/.c9/"node.exe ] || [ ! -d "$HOME/.c9/"msys ]; then
        echo "downloading node"
        pushd "$HOME/.c9/"
        curl -L https://raw.githubusercontent.com/cloud9ide/sdk-deps-win32/master/install.sh | bash
        # bash $SOURCE/../sdk-deps-win32/install.sh # for testing
        popd
    fi
    
    NW_FILE_NAME=nwjs-$NW_VERSION-win-ia32
    if [ ! -f $NW_FILE_NAME.zip ]; then
        echo "downloading node-webkit"
        curl -OL http://dl.nwjs.io/$NW_VERSION/$NW_FILE_NAME.zip
    fi
    
    dest=win32-dev/bin
    mkdir -p $dest
    
    unzip -uo $NW_FILE_NAME.zip -d win32-dev
    rm -rf $dest
    mv win32-dev/$NW_FILE_NAME $dest
    # cp node.exe $dest
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
    # create shortcuts
    echo '
        var WshShell = WScript.CreateObject("WScript.Shell");
        var strDesktop = WshShell.SpecialFolders("Desktop");
        var cwd = WScript.ScriptFullName.replace(/\\[^\\]+$/, "");
        var link1 = WshShell.CreateShortcut(cwd + "\\Cloud9#.lnk");
        link1.TargetPath = cwd + "\\build\\win32-dev\\bin\\Cloud9.exe";
        link1.IconLocation = cwd + "\\build\\win32\\Cloud9.ico";
        link1.Description = "Cloud9";
        link1.WorkingDirectory = cwd;
        link1.Save();

        var link2 = WshShell.CreateShortcut(cwd + "\\Cloud9#packed.lnk");
        link2.TargetPath = link1.TargetPath;
        link2.Arguments = "--packed --no-devtools";
        link2.IconLocation = link1.IconLocation;
        link2.Description = "Cloud9";
        link2.WorkingDirectory = cwd;
        link2.Save();
        ' > ./shortcut.wscript.js
    cscript //NoLogo //B //E:jscript ./shortcut.wscript.js
    rm -f ./shortcut.wscript.js
    
    current_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    bash "$current_dir/makelocal.sh"
fi



