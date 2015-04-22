#!/bin/bash -e

cd `dirname $0`/..
SOURCE=`pwd`

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

red=$'\e[01;31m'
green=$'\e[01;32m'
yellow=$'\e[01;33m'
blue=$'\e[01;34m'
magenta=$'\e[01;35m'
resetColor=$'\e[0m'

NO_PULL=
NO_GLOBAL_INSTALL=
FORCE=

updatePackage() {
    name=$1
    
    REPO=https://github.com/c9/$name
    echo "${green}checking out ${resetColor}$REPO"
    
    if ! [[ -d ./plugins/$name ]]; then
        mkdir -p ./plugins/$name
    fi
    
    pushd ./plugins/$name
    if ! [[ -d .git ]]; then
        git init
        # git remote rm origin || true
        git remote add origin $REPO
    fi
    
    version=`"$NODE" -e 'console.log((require("../../package.json").c9plugins["'$name'"].substr(1) || "origin/master"))'`;
    rev=`git rev-parse --revs-only $version`
    
    if [ "$rev" == "" ]; then
        git fetch origin
    fi
    
    status=`git status --porcelain --untracked-files=no`
    if [ "$status" == "" ]; then
        git reset $version --hard
    else
        echo "${yellow}$name ${red}contains uncommited changes.${yellow} Skipping...${resetColor}"
    fi
    popd
}

updateAllPackages() {
    c9packages=(`"$NODE" -e 'console.log(Object.keys(require("./package.json").c9plugins).join(" "))'`)
    count=${#c9packages[@]}
    i=0
    for m in ${c9packages[@]}; do echo $m; 
        i=$(($i + 1))
        echo "updating plugin ${blue}$i${resetColor} of ${blue}$count${resetColor}"
        updatePackage $m
    done
}

updateNodeModules() {
    echo "${magenta}--- Running npm install --------------------------------------------${resetColor}"
    safeInstall(){
        deps=(`"$NODE" -e 'console.log(Object.keys(require("./package.json").dependencies).join(" "))'`)
        for m in $deps; do echo $m; 
            "$NPM" install --loglevel warn $m || true
        done
    }
    "$NPM" install || safeInstall
    echo "${magenta}--------------------------------------------------------------------${resetColor}"
}

updateCore() {
    if [ "$NO_PULL" ]; then 
        return 0;
    fi
    
    # without this git merge fails on windows
    mv ./scripts/install-sdk.sh  ./scripts/.install-sdk-tmp.sh 
    cp ./scripts/.install-sdk-tmp.sh ./scripts/install-sdk.sh
    git checkout -- ./scripts/install-sdk.sh

    git remote add c9 https://github.com/c9/core 2> /dev/null || true
    git fetch c9
    git merge c9/master --ff-only || \
        echo "${yellow}Couldn't automatically update sdk core ${resetColor}"

    ## TODO use fetched script?
    # oldScript="$(cat ./scripts/install-sdk.sh)"
    # newScript="$(cat ./scripts/install-sdk.sh)"
    # if ! [ "$oldScript" == "$newScript" ]; then
    #     ./scripts/install-sdk.sh --no-pull
    #     exit
    # fi
}



installGlobalDeps() {
    if ! [[ -f ~/.c9/installed ]] && ! [[ $os == "windows" ]]; then
        curl https://raw.githubusercontent.com/c9/install/master/install.sh | bash
    fi
}

############################################################################
NPM=npm
NODE=node

# cleanup build cache since c9.static doesn't do this automatically yet
rm -rf ./build/standalone

# pull the latest version
updateCore || true

installGlobalDeps
updateAllPackages
updateNodeModules

echo "Success!"
echo "run '${yellow}node server.js -p 8181 -l 0.0.0.0 -a :${resetColor}' to launch Cloud9"
