#!/bin/bash
set -e
cd `dirname $0`/..

NAME=$1
URL=$2
if [ "$NAME" == "" ]; then
    echo "add name [url]"
    exit 0
fi

if [ "$URL" == "" ]; then
    URL=git@github.com:c9/$NAME.git
fi

if [ -d $NAME/.git ]; then
    pushd $NAME
    OLD_URL=$(git config --get remote.origin.url)
    if [ "$OLD_URL" != "$URL" ]; then
        echo "folder $NAME exists and points to $OLD_URL"
        exit 1
    fi
    git fetch origin
    popd
else
    mkdir -p $NAME
    git clone $URL $NAME
fi

pushd $NAME
HASH=$(git rev-parse --revs-only refs/remotes/origin/master)
popd

[ -f ./config.json ] || echo "{}" > ./config.json
node -e '
    var name = "'$NAME'";
    var url = "'$URL'";
    var hash = "'$HASH'"
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
        console.log(deps[name], hash)
        deps[name] = deps[name].replace(/#[a-f\d]+$/i, "#" + hash)
        console.log(deps[name], hash)
    });
    updateJSON("../npm-shrinkwrap.json", function(package) {
        var deps = package.dependencies;
        deps[name].from = deps[name].from.replace(/#[a-f\d]+$/i, "#" + hash);
        deps[name].resolved = deps[name].resolved.replace(/#[a-f\d]+$/i, "#" + hash);
    });
'

rm -rf "../node_modules/$NAME"
ln -s `pwd`/$NAME `pwd`/../node_modules/$NAME

