#!/bin/bash -e

cd `dirname $0`/..

npm dedupe
npm shrinkwrap