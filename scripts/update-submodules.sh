#!/usr/bin/env bash

c9plugins=$(sed -n '/c9plugins/,/}/p' package.json | sed '1d;$d;s/[\"#, ]//g')
count=$(wc -l <<< "$c9plugins" | xargs)
index=0

bold=$(tput bold)
norm=$(tput sgr0)

cd plugins
while read plugin; do
    package=$(echo "$plugin" | cut -d ':' -f 1)
    version=$(echo "$plugin" | cut -d ':' -f 2)
	index=$(($index + 1))

    printf "$bold>> Updating $package #$version ($index/$count) $norm\n"

    git submodule add https://github.com/c9/$package
    pushd $package
	git fetch
    git checkout $version
    popd
done <<< "$c9plugins"
