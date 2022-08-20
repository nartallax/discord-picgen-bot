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
5. Add your bot account to your server. This bot will require following permissions: Guild, GuildMessages, GuildMessageReactions.

To get the idea what do bot expect from picture generator, look into `picture_generator_example.js` (it's VERY simple and heavily commented)  

## Launch

Run `node bot.js` in the directory you're installed this stuff into at the install step.  
Bot writes its logs into stderr, so maybe you want to pipe it somewhere. It's up to you, who am I to tell you how to launch your bot, right? :3  
You don't really need `picture_generator_example.js` and `config.example.json` after you're set up, they are just an examples. You can safely delete them.  

## Usage

Main commands are `/dream` and `/dreamhelp`.  

## Config text parameters

You can use configure almost every text bot produces through parameters inside `"text"` object of config.  
If some parameter is absent, bot won't produce that kind of text. It implies that if the whole 	`"text"` object is absent, bot will only ever produce pictures. Bot will still reply to interactions with empty message, because interactions imply that bot will reply something.  

You can use `$VARIABLES` inside text template strings. Set of available variables differs from template to template.  
Command and command parameter descriptions does not have any variables.  
Templates that imply some command is being executed usually have `USER` and `COMMAND` variables.  
Templates that imply work on some task usually have following set of variables: `TASK_ID`, `USER_INPUT_RAW`, `PICTURES_EXPECTED`, `PICTURES_GENERATED`, `PARAMS_NICE`, `PARAMS_NICE_FULL`, `USER`, `PROMPT`, `PROMPT_SHORT`, `TIME_PASSED`, `DROPPED_PROMPT_WORDS_COUNT`, `PROMPT_WORDS_LIMIT`.  
For some special templates more variables are added to the mix (like `GENERATED_PICTURE_PATH` for all templates related to output files).  

### Private text parameters

When text template implies a task, it usually exist in one of two forms: public and private.  
User can select which one will be used by special parameter (`"role": "private"` on some boolean parameter will mark this parameter as that special parameter).  
If `"private"` template is not present, but `"public"` template is, `"public"` template will be used.  
It is implied that `"private"` template will disclose less information about generation; however, what exactly will be shown is up to config.  

## Reaction shortcuts

Bot will add reactions to some of the messages he leave. They are shortcuts to some other commands bot have. User can trigger those shortcuts by adding another reaction.  
Bot will only be triggered by adding a reaction for a limited amount of time (`"reactionWaitingTimeSeconds"` in config). This is done for performance reasons, as Discord don't store full information about interactions, but bot does.  
If bot don't trigger on a user adding a reaction, then it probably lacks permissions to receive information about reactions.  
