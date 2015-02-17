#!/bin/bash -ex

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
esac

if ! [[ -f ~/.c9/installed ]] && ! [[ $os == "windows" ]]; then
    curl https://raw.githubusercontent.com/c9/install/master/install.sh | bash
fi


installC9Package() {
    name=$1
    
    REPO=https://github.com/c9/$name
    
    echo "checking out $REPO"
    
    if ! [[ -d ./plugins/$name ]]; then
        mkdir -p ./plugins/$name
    fi
    
    pushd ./plugins/$name
    if ! [[ -d .git ]]; then
        git init
        # git remote rm origin || true
        git remote add origin $REPO
    fi
    
    version=`node -e 'console.log((require("../../package.json").c9plugins["'$name'"].substr(1) || "origin/master"))'`;
    rev=`git rev-parse --revs-only $version`
    
    if [ "$rev" == "" ]; then
        git fetch origin
    fi
    
    status=`git status --porcelain --untracked-files=no`
    if [ "$status" == "" ]; then
        git reset $version --hard
    else
        echo "$name contains uncommited changes. Skipping..."
    fi
    popd
}

c9packages=(`node -e 'console.log(Object.keys(require("./package.json").c9plugins).join(" "))'`);
count=${#c9packages[@]}
i=0
for m in ${c9packages[@]}; do echo $m; 
    i=$(($i + 1))
    echo "updating plugin $i of $count"
    installC9Package $m || true
done


# deps=`node -e 'console.log(Object.keys(require("./package.json").dependencies).join(" "))'`; 
# for m in $deps; do echo $m; 
#     npm install $m || true
# done
npm install || true


echo "Success!"
echo "run 'node server.js -p 8181 -l 0.0.0.0' to launch Cloud9"