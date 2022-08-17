#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

./scripts/package_sync.sh
./node_modules/.bin/imploder --tsconfig tsconfig.json