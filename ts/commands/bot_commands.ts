import {CommandDef, CommandResult, MessageReacts} from "bot"
import {makeGenerationCommand} from "commands/generation_command"
import {makeHelpCommand} from "commands/help_command"
import {makeRepeatCommand} from "commands/repeat_command"
import {AppContext} from "context"
import {GenerationFormatter} from "formatters/generation_formatter"
import {GenRunner, TaskCommandResult} from "gen_runner"
import {CommandDescription, GenTask} from "types"

export type CommandMap = {readonly [cmdName: string]: CommandDef}

export type StartGenResult = CommandResult & {readonly taskId?: number}
export function startGen(context: AppContext, task: GenTask, formatter: GenerationFormatter, runner: GenRunner): StartGenResult {
	let resp: string | undefined
	if(context.queue.isPaused){
		resp = formatter.newTaskCreatedPaused(task)
	} else {
		resp = formatter.newTaskCreated(task)
	}
	if(task.droppedPromptWordsCount > 0){
		const wordsDropped = formatter.promptWordsDroppedOnTaskCreation(task)
		if(wordsDropped){
			resp = (resp ? resp + "\n\n" : "") + wordsDropped
		}
	}
	context.queue.put(task, runner)
	return {reply: resp, taskId: task.id}
}

// FIXME: reacts should be tighly coupled with commands, and should check permissions before invoking commands
export const displayQueueReact: MessageReacts = {
	"🗒️": async(context, reaction) => {
		await context.bot.runCommand({
			roleName: context.bot.getRoleName(reaction.reactUserId),
			channelId: reaction.channelId,
			messageId: reaction.messageId,
			command: "status",
			options: {},
			userId: reaction.reactUserId
		})
	}
}

export const saveMessageReact: MessageReacts = {
	"💾": async(context, reaction) => {
		const saveChannelId = context.config.savedPropmtsChannelID
		if(!saveChannelId){
			throw new Error("Cannot save stuff: no save channel id is provided.")
		}

		const cmdResult = reaction.commandResult as TaskCommandResult
		if(cmdResult.saved){
			return
		}
		cmdResult.saved = true

		await context.bot.mbSend(saveChannelId, {
			content: context.formatter.savedPrompt(cmdResult.task),
			files: await context.bot.downloadAttachments(reaction.channelId, reaction.messageId)
		})
	}
}

export const starMessageReact: MessageReacts = {
	"⭐": async(context, reaction) => {
		const starredPromptsChannelID = context.config.starredPromptsChannelID
		if(!starredPromptsChannelID){
			throw new Error("Cannot save stuff: no starred channel id is provided.")
		}

		const cmdResult = reaction.commandResult as TaskCommandResult
		if(cmdResult.starred){
			return
		}
		cmdResult.starred = true

		await context.bot.mbSend(starredPromptsChannelID, {
			content: context.formatter.starredPrompt(cmdResult.task),
			files: await context.bot.downloadAttachments(reaction.channelId, reaction.messageId)
		})
	}
}

export const repeatReact: MessageReacts = {
	"🔁": async(context, reaction) => {
		await context.bot.runCommand({
			roleName: context.bot.getRoleName(reaction.reactUserId),
			attachments: await context.bot.parseAttachments(reaction.commandMessage.channelId, reaction.commandMessage.messageId),
			command: reaction.commandMessage.command,
			options: reaction.commandMessage.options,
			channelId: reaction.channelId,
			messageId: reaction.messageId,
			userId: reaction.reactUserId
		})
	}
}

export function makeCommands(context: AppContext): CommandMap {

	const result: {[k: string]: CommandDef} = {
		...defaultCommands
	}

	for(const commandName in context.config.commands){
		const description = context.config.commands[commandName]!
		result[commandName] = makeCommandByDescription(context, commandName, description)
	}

	return result
}

function makeCommandByDescription(context: AppContext, name: string, cmd: CommandDescription): CommandDef {
	switch(cmd.type){
		case "generation": return makeGenerationCommand(context, name, cmd)
		case "help": return makeHelpCommand(context, cmd)
		case "repeat_generation": return makeRepeatCommand(context, cmd)
	}
}

const defaultCommands: CommandMap = {
	lenny: {
		description: () => "( ͡° ͜ʖ ͡°)",
		handler: context => {
			return {reply: context.formatter.lenny()}
		},
		reacts: {
			"🤔": async(context, reaction) => {
				await context.bot.runCommand({
					roleName: context.bot.getRoleName(reaction.reactUserId),
					command: "lenny",
					options: {},
					channelId: reaction.channelId,
					messageId: reaction.messageId,
					userId: reaction.reactUserId
				})
			}
		}
	},

	status: {
		description: context => context.formatter.statusDescription(),
		handler: (context, command) => {
			let result = ""

			const runningTask = context.queue.currentRunningTask
			if(runningTask){
				const str = context.formatter.statusRunningTask(runningTask) || ""
				const prefix = context.formatter.statusRunningTaskPrefix(command) || ""
				result += prefix + str
			}

			let queueStr = ""
			const queuedItems = [...context.queue]
			const maxTasksShownInStatus = context.config.maxTasksShownInStatus || 10
			for(const queuedItem of queuedItems.slice(0, maxTasksShownInStatus)){
				const str = context.formatter.statusQueuedTask(queuedItem) || ""
				if(str){
					if(queueStr){
						queueStr += "\n"
					}
					queueStr += str
				}
			}
			const unshownTasksCount = Math.max(0, queuedItems.length - maxTasksShownInStatus)
			if(unshownTasksCount > 0){
				queueStr += "\n" + context.formatter.statusTasksUnshown(command, unshownTasksCount)
			}

			if(queueStr){
				const queuePrefix = context.formatter.statusQueuedTaskPrefix(command) || ""
				if(result){
					result += "\n\n"
				}
				result += queuePrefix + queueStr
			}

			let isRefuse = false
			if(!result){
				result = context.formatter.statusNoTasks(command) || ""
				isRefuse = true
			}

			return {reply: result, isRefuse}
		},
		reacts: {
			"🔪": async(context, reaction) => {
				await context.bot.runCommand({
					roleName: context.bot.getRoleName(reaction.reactUserId),
					command: "kill",
					options: {},
					channelId: reaction.channelId,
					messageId: reaction.messageId,
					userId: reaction.reactUserId
				})
			},
			"🔥": async(context, reaction) => {
				await context.bot.runCommand({
					roleName: context.bot.getRoleName(reaction.reactUserId),
					command: "purge",
					options: {},
					channelId: reaction.channelId,
					messageId: reaction.messageId,
					userId: reaction.reactUserId
				})
			},
			"🧼": async(context, reaction) => {
				await context.bot.runCommand({
					roleName: context.bot.getRoleName(reaction.reactUserId),
					command: "clear",
					options: {},
					channelId: reaction.channelId,
					messageId: reaction.messageId,
					userId: reaction.reactUserId
				})
			},
			...displayQueueReact
		}
	},

	drop: {
		description: context => context.formatter.dropDescription(),
		params: {
			task_id: {
				type: "number",
				description: context => context.formatter.dropTaskIdDescription(),
				required: true
			}
		},
		handler: (context, command) => {
			const taskId = command.options.task_id
			if(typeof(taskId) !== "number" || !taskId || Number.isNaN(taskId)){
				return {
					reply: context.formatter.dropNoTaskId(command),
					isRefuse: true
				}
			}
			const currentTask = context.queue.currentRunningTask
			if(currentTask && currentTask.id === taskId){
				context.queue.killCurrentTask()
				return {
					reply: context.formatter.dropKilledRunningTask(command, currentTask)
				}
			}
			const droppedTask = context.queue.drop(taskId)
			if(droppedTask){
				return {reply: context.formatter.dropDequeuedTask(command, droppedTask)}
			}
			return {
				reply: context.formatter.dropTaskNotFound(command, taskId),
				isRefuse: true
			}
		}
	},

	purge: {
		description: context => context.formatter.purgeDescription(),
		handler: (context, command) => {
			context.queue.clear()
			if(context.queue.currentRunningTask){
				context.queue.killCurrentTask()
			}
			return {reply: context.formatter.purgeCompleted(command)}
		},
		reacts: displayQueueReact
	},

	clear: {
		description: context => context.formatter.clearDescription(),
		handler: (context, command) => {
			context.queue.clear()
			return {reply: context.formatter.clearCompleted(command)}
		},
		reacts: displayQueueReact
	},

	kill: {
		description: context => context.formatter.killDescription(),
		handler: (context, command) => {
			const currentTask = context.queue.currentRunningTask
			if(currentTask){
				context.queue.killCurrentTask()
				return {reply: context.formatter.killSuccess(command, currentTask)}
			} else {
				return {
					reply: context.formatter.killTaskNotFound(command),
					isRefuse: true
				}
			}
		},
		reacts: displayQueueReact
	},

	ping: {
		description: context => context.formatter.pingDescription(),
		handler: (context, command) => {
			const timeDiff = Math.max(0, (Date.now() - (command.creationTime || 0)) / 1000)
			return {
				reply: context.formatter.pingReply(command, timeDiff)
			}
		}
	},

	pause: {
		description: context => context.formatter.pauseDescription(),
		handler: (context, command) => {
			context.queue.pause()
			return {reply: context.formatter.pauseReply(command)}
		},
		reacts: displayQueueReact
	},

	unpause: {
		description: context => context.formatter.unpauseDescription(),
		handler: (context, command) => {
			context.queue.unpause()
			const task = context.queue.currentRunningTask
			const reply = task ? context.formatter.unpauseReply(command, task) : context.formatter.unpauseReplyNoTask(command)
			return {reply}
		},
		reacts: displayQueueReact
	}

}