#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

./scripts/build.sh
cp ./README.md ./target/
cp ./config.example.json ./target/
cp ./picture_generator_example.js ./target/
cp ./package.json ./target/
cp ./package-lock.json ./target/
cd target

ARCHIVE_NAME=discord_picgen_bot.zip
zip -r "$ARCHIVE_NAME" ./*
echo "Completed! Output file is $ARCHIVE_NAME."
