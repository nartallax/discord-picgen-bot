#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

./scripts/build.sh
node target/bot.js