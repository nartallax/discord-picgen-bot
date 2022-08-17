#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

if [ ! -d "./node_modules" ] ; then
    npm install
    ./node_modules/.bin/package_syncer --remembe
else
    ./node_modules/.bin/package_syncer
fi