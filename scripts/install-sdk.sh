#!/bin/bash -e

cd `dirname $0`/..
SOURCE=`pwd`


if ! [[ -f ~/.c9/installed ]];
    https://raw.githubusercontent.com/c9/install/master/install.sh | bash
    then echo 1;
fi


deps=`node -e 'console.log(Object.keys(require("./package.json").dependencies).join(" "))'`; 
for m in $deps; do echo $m; 
    cp -R ../newclient/node_modules/$m node_modules ;  
done


installC9Package() {
    name=$1
    
    REPO=https://github.com/c9/$name
    
    echo "checking out $REPO"
    
    if ! [[ -d ./plugins/$name ]]; then
        mkdir -p ./plugins/$name
    fi
    
    pushd ./plugins/$name
    if ! [[ -d ./plugins/$name/.git ]]; then
        git init
        git remote add origin $REPO
    fi
    
    git fetch origin
    
    version=`node -e 'console.log(require("./package.json").c9packages["'$name'"].substr(1))'`;
    
    status=`git status --porcelain --untracked-files=no`
    if [ "$status" == "" ]; then
        git reset $version --hard
    else
        echo "$name contains uncommited changes. Skipping..."
    fi
    popd
}

c9packages=`node -e 'console.log(Object.keys(require("./package.json").c9packages).join(" "))'`; 
for m in $c9packages; do echo $m; 
    # cp -R ../newclient/plugins/$m plugins ;  
    installC9Package $m
done
