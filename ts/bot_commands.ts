import {CommandArr} from "bot"
import * as Discord from "discord.js"
import {genInputToString} from "input_parser"

export const commands: readonly CommandArr[] = [

	[
		"lenny", // just for lulz
		"( ͡° ͜ʖ ͡°)",
		interaction => {
			interaction.reply("( ͡° ͜ʖ ͡°)")
		}
	],

	[
		"dreamhelp",
		"Displays help about /dream command",
		(interaction, context) => {
			let str = context.cmdParser.makeHelpStr()
			const header = context.config.helpHeader || "Usage: /dream prompt [params]"
			str = header + "\n\n" + str
			interaction.reply("```\n" + str + "\n```")
		}
	],

	[
		new Discord.SlashCommandBuilder()
			.setName("dream")
			.setDescription("Generate a picture by parameters")
			.addStringOption(opt => opt.setName("params")
				.setDescription("A string with a prompt and other parameters")
				.setRequired(true)
			)
			.toJSON(),
		(interaction, context) => {
			const paramsStr = interaction.options.get("params")?.value
			if(typeof(paramsStr) !== "string"){
				interaction.reply("Hey, where's parameters? I need them to generate anything, y'know.")
				return
			}
			const input = context.cmdParser.parse(paramsStr, interaction)
			interaction.reply("Got new task: " + genInputToString(input, context.config))
			context.queue.put(input)
		}
	],

	[
		"status",
		"Display generation queue and currently processed task",
		(interaction, context) => {
			let result = ""
			const runningState = context.runner.describeCurrentTask()
			if(runningState){
				result += "Running:\n" + runningState + "\n\n"
			}

			const queueState = context.queue.showItems()
			if(queueState){
				result += "Queued:\n" + queueState
			}

			if(!result){
				result = "Nothing going on!"
			}

			interaction.reply(result)
		}
	],

	[
		new Discord.SlashCommandBuilder()
			.setName("drop")
			.setDescription("Drop a specific task by its ID")
			.addNumberOption(opt => opt.setName("task_id")
				.setDescription("ID of task to be dropped")
				.setRequired(true)
			)
			.toJSON(),
		(interaction, context) => {
			const taskId = interaction.options.get("task_id")?.value
			if(typeof(taskId) !== "number" || !taskId || Number.isNaN(taskId)){
				interaction.reply("Hey, gimme a task ID! What task should I drop?")
				return
			}
			if(context.runner.currentRunningTask?.input.id === taskId){
				context.runner.killCurrentTask()
				interaction.reply(`Task #${taskId} was the current running task. Stopped.`)
				return
			}
			if(context.queue.drop(taskId)){
				interaction.reply(`Removed task #${taskId} from the queue.`)
				return
			}
			interaction.reply(`Could not find task #${taskId} anywhere. You sure you're not mistaken?`)
		}
	],

	[
		"purge",
		"Stop current generation and clear the queue",
		(interaction, context) => {
			context.queue.clear()
			if(context.runner.currentRunningTask){
				context.runner.killCurrentTask()
			}
			interaction.reply("Purged! :fire:")
		}
	],

	[
		"clear",
		"Clear the queue without stopping current generation",
		(interaction, context) => {
			context.queue.clear()
			interaction.reply("Cleared! :soap:")
		}
	],

	[
		"kill",
		"Interrupt currently running task",
		(interaction, context) => {
			if(context.runner.currentRunningTask){
				context.runner.killCurrentTask()
				interaction.reply("Killed! :knife:")
			} else {
				interaction.reply("No task is running, what do you want from me, weird human?")
			}

		}
	]
]