#!/bin/bash
set -euo pipefail

cd `dirname $0`
npm i
if ! [ -d acorn/.git ]; then
    git clone https://github.com/c9/acorn
fi
pushd acorn
git fetch origin
git reset origin/master --hard
npm i
npm run build
popd

cp acorn/dist/* node_modules/acorn/dist

node eslint.js
