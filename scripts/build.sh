#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

./scripts/package_sync.sh
rm -rf ./target
./node_modules/.bin/imploder --tsconfig tsconfig.json