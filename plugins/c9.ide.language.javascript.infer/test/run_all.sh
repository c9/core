#!/bin/sh -e

for f in *_test.js; do
  echo RUNNING $f
  node $f
done
