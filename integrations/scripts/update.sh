#!/bin/bash
set -e
cd `dirname $0`/..

NAME=$1
shift 
BRANCH=master
URL=
FORCE=
for i in "$@"; do
    case $i in
        -d|--debug)
            set -x
            shift
        ;;
        -b=*|--branch=*)
            BRANCH="${i#*=}"
            shift
        ;;
        -u=*|--url=*)
            URL="${i#*=}"
            shift
        ;;
        -f|--force|--hard)
            FORCE=1
            shift
        ;;
        *)
            # unknown option
        ;;
    esac
done

if [ "$NAME" == "" ]; then
    echo "add name [--url=git@github.com:c9/NAME.git] [--branch=master]"
    exit 0
fi

update_one() {
    echo adding name=$NAME url=$URL branch=refs/remotes/origin/$BRANCH
    
    if [ "$URL" == "" ]; then
        URL=git@github.com:c9/$NAME.git
    fi
    
    mkdir -p $NAME
    pushd $NAME
    
    if ! [ -d .git ]; then
        git init .
        git remote add origin "$URL"
    fi
        
    OLD_URL=$(git config --get remote.origin.url)
    if [ "$OLD_URL" != "$URL" ]; then
        echo "folder $NAME exists and points to $OLD_URL"
        exit 1
    fi
    if ! $(git config --get-all remote.origin.fetch | grep -q pull); then 
        git config --add remote.origin.fetch "+refs/pull/*/head:refs/remotes/pull/*";
    fi
    git fetch origin
    git remote set-head origin -a
    popd
    
    pushd $NAME
    HASH=$(git rev-parse --revs-only refs/remotes/origin/$BRANCH)
    if [ "$FORCE" == "1" ]; then
        echo "hard reset $NAME to $HASH"
        git reset $HASH --hard
        if $(grep -q dependencies "./package.json"); then
            rm -rf node_modules npm-shrinkwrap.json
            git reset --hard
            npm i
            npm shrinkwrap
        fi
    fi
    popd
    
    [ -f ./config.json ] || echo "{}" > ./config.json
    node -e '
        var name = "'$NAME'";
        var url = "'$URL'";
        var hash = "'$HASH'".trim();
        var fs = require("fs");
        
        function updateJSON(path, fn) {
            var text = fs.readFileSync(path, "utf8");
            var indent = text.match(/^\s*(?=")/m);
            indent = indent && indent[0] || 4;
            console.log(indent)
            var r = JSON.parse(text);
            r = fn(r) || r;
            text = JSON.stringify(r, null, indent) + "\n";
            fs.writeFileSync(path, text, "utf8");
        }
        
        updateJSON("./config.json", function(config) {
            var packages = config.packages || (config.packages = {});
            config.packages[name] = {
                name: name,
                hash: hash,
                url: url,
            };
        });
        updateJSON("../package.json", function(package) {
            var deps = package.dependencies;
            console.log(deps[name], hash);
            deps[name] = deps[name].replace(/#[a-f\d]*$/i, "#" + hash);
            console.log(deps[name], hash);
        });
        updateJSON("../npm-shrinkwrap.json", function(package) {
            var deps = package.dependencies;
            deps[name].from = deps[name].from.replace(/#[a-f\d]*$/i, "#" + hash);
            deps[name].resolved = deps[name].resolved.replace(/#[a-f\d]*$/i, "#" + hash);
            console.log(__dirname)
            if (fs.existsSync(name + "/npm-shrinkwrap.json")) {
                var shrinkwrap = JSON.parse(fs.readFileSync(name + "/npm-shrinkwrap.json", "utf8"));
                deps[name].dependencies = shrinkwrap.dependencies;
            }
        });
    '
    
    rm -rf "../node_modules/$NAME"
    ln -s `pwd`/$NAME `pwd`/../node_modules/$NAME
}


if [ "$NAME" == "all" ]; then
    for i in $(ls .); do
        if [ -d "./$i/.git" ] || [ -f "./$i/package.json" ]; then 
            NAME=$i
            URL=
            update_one;
        fi;
    done
else
    update_one
fi


