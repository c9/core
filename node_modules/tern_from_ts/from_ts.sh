#!/bin/bash -e

MY_DIR=$(cd $(dirname $BASH_SOURCE); pwd)

: ${2:?Usage: from_ts.sh (PATH|URL) TARGET.json}

readonly SOURCE=$1
readonly TARGET=$2

echo -n $SOURCE

reportError() {
    echo " - error: $(cat | grep Error:)"
}

filterBadTypes() {
    node -pe '
        var json = JSON.parse(require("fs").readFileSync("'$TARGET.tmp'"));
        function removeBadTypes(entry) {
            if (typeof entry === "string")
                return entry;
            for (var p in entry) {
                entry[p] = removeBadTypes(entry[p]);
                if (entry[p]["!type"] && !/^(fn\(|\[)/.test(entry[p]["!type"]))
                    delete entry[p]["!type"];
            }
            return entry;
        }
        json["!name"] = json["!name"].replace(/.d.ts$/, "");
        JSON.stringify(removeBadTypes(json), null, 2);
    '
}

if ! ERROR=$($MY_DIR/node_modules/tern/bin/from_ts "$SOURCE" 2>&1 | sed 's/\[object Object\]/?/g' >$TARGET.tmp); then
    rm -f $TARGET.tmp $TARGET
    echo "$ERROR" | reportError
else
    if ! node -e 'JSON.parse(require("fs").readFileSync("'$TARGET.tmp'").toString())' 2>/dev/null; then
        # Error reported with zero exit code
        cat $TARGET.tmp | reportError
        rm -f $TARGET.tmp $TARGET
        exit
    fi
    
    if [ $(cat $TARGET.tmp | wc -l) -lt 7 ]; then
        echo "Output file really short, no definitions found?"
        rm -f $TARGET.tmp
        exit
    fi

    filterBadTypes > $TARGET
    rm $TARGET.tmp
    echo
fi

