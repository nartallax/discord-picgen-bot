# DISCORD PICTURE GENERATOR BOT

A bot that wraps some other tool for picture generation.

## Building

Skip this step if you're given pre-built file.

```bash
./scripts/build_and_zip.sh
```

Will generate .zip-file with all the stuff.

## Install

0. Unzip the .zip-archive in a separate folder.  
1. Ensure you're have NodeJS installed. This bot was developed at 16th version of NodeJS, probably will work on more modern versions of Node, and maaaybe will work on older versions. You can check what version Node is installed by running `node --version` command.  
2. Run `npm install` in the directory you've unzipped archive in step 0.  
3. Get your bot token and put it into `token.txt` in that directory.  
4. Set up config. You have example config at `config.example.json`; copy it into `config.json` and adjust values you want to adjust.  

## Launch

Run `node main.js` in the directory you're installed this stuff into at the install step.  
