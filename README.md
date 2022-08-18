# Discord picture generator bot

A bot that wraps some other tool for picture generation.  
[Sources are here, if you're curious](https://github.com/nartallax/discord-picgen-bot)  

## Building

Skip this step if you're given pre-built file.

```bash
./scripts/build_and_zip.sh
```

Will generate .zip-file with all the stuff.

## Install

0. Unzip the .zip-archive in a separate folder.  
1. Ensure you're have NodeJS installed. This bot was developed at 16th version of NodeJS, probably will work on more modern versions of Node, and maaaybe will work on older versions. You can check what version Node is installed by running `node --version` command.  
2. Run `npm install` in the directory you've unzipped archive into at step 0.  
3. Get your bot token and put it into `token.txt` in that directory.  
4. Set up config. You have example config at `config.example.json`; copy it into `config.json` and adjust values you want to adjust. You probably want to put your guild and change command template, and maybe something else.  

To get the idea what do bot expect from picture generator, look into `picture_generator_example.js` (it's VERY simple and heavily commented)  

## Launch

Run `node bot.js` in the directory you're installed this stuff into at the install step.  
Bot writes its logs into stderr, so maybe you want to pipe it somewhere. It's up to you, who am I to tell you how to launch your bot, right? :3  
You don't really need `picture_generator_example.js` and `config.example.json` after you're set up, they are just an examples. You can safely delete them.  

## Usage

Main commands are `/dream` and `/dreamhelp`.  
