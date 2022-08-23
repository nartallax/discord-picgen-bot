import {CommandDef, CommandResult, MessageReacts} from "bot"
import {AppContext} from "context"
import {TaskCommandResult} from "gen_runner"
import {GenTask} from "types"

type StartGenResult = CommandResult & {taskId?: number}
function startGen(context: AppContext, task: GenTask): StartGenResult {
	let resp = context.formatter.dreamNewTaskCreated(task)
	if(task.droppedPromptWordsCount > 0){
		resp += "\n\n" + context.formatter.dreamPromptWordsDroppedOnTaskCreation(task)
	}
	context.queue.put(task)
	return {reply: resp, taskId: task.id}
}

export const displayQueueReact: MessageReacts = {
	"🗒️": (context, reaction) => {
		context.bot.runCommand({
			channelId: reaction.channelId,
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

export const reDreamReact: MessageReacts = {
	"🔁": (context, react) => {
		context.bot.runCommand({
			command: "dream",
			options: react.commandMessage.options,
			channelId: react.channelId,
			userId: react.reactUserId
		})
	}
}

const _commands = {
	lenny: cmd({
		description: () => "( ͡° ͜ʖ ͡°)",
		handler: context => {
			return {reply: context.formatter.lenny()}
		},
		reacts: {
			"🤔": (context, reaction) => {
				context.bot.runCommand({
					command: "lenny",
					options: {},
					channelId: reaction.channelId,
					userId: reaction.reactUserId
				})
			}
		}
	}),

	dreamhelp: cmd({
		description: context => context.formatter.dreamhelpDescription(),
		handler: (context, command) => {
			let str = context.cmdParser.makeHelpStr()
			const header = context.formatter.dreamhelpHeader(command)
			str = (header ? header + "\n\n" : "") + str
			return {reply: "```\n" + str + "\n```"}
		}
	}),

	dream: cmd({
		description: context => context.formatter.dreamDescription(),
		params: {
			params: {
				type: "string",
				description: context => context.formatter.dreamParamDescription(),
				required: true
			}
		},
		reacts: {
			"🔪": (context, react) => {
				const taskId = (react.commandResult as StartGenResult).taskId
				if(taskId){
					context.bot.runCommand({
						command: "drop",
						options: {task_id: taskId},
						channelId: react.channelId,
						userId: react.reactUserId
					})
				}
			},
			...displayQueueReact
		},
		handler: async(context, command) => {
			const paramsStr = command.options.params
			if(typeof(paramsStr) !== "string"){
				return {
					reply: context.formatter.dreamNoParams(command),
					isRefuse: true
				}
			}
			const task = await context.cmdParser.parse(command, paramsStr, command)
			return startGen(context, task)
		}
	}),

	status: cmd({
		description: context => context.formatter.statusDescription(),
		handler: (context, command) => {
			let result = ""

			const runningTask = context.runner.currentRunningTask
			if(runningTask){
				const str = context.formatter.statusRunningTask(runningTask) || ""
				const prefix = context.formatter.statusRunningTaskPrefix(command) || ""
				result += prefix + str
			}

			let queueStr = ""
			for(const queuedItem of context.queue){
				const str = context.formatter.statusQueuedTask(queuedItem) || ""
				if(str){
					if(queueStr){
						queueStr += "\n"
					}
					queueStr += str
				}
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
			"🔪": (context, react) => {
				context.bot.runCommand({
					command: "kill",
					options: {},
					channelId: react.channelId,
					userId: react.reactUserId
				})
			},
			"🔥": (context, react) => {
				context.bot.runCommand({
					command: "purge",
					options: {},
					channelId: react.channelId,
					userId: react.reactUserId
				})
			},
			"🧼": (context, react) => {
				context.bot.runCommand({
					...react.commandMessage,
					command: "clear",
					options: {},
					userId: react.reactUserId
				})
			},
			...displayQueueReact
		}
	}),

	drop: cmd({
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
			const currentTask = context.runner.currentRunningTask
			if(currentTask && currentTask.id === taskId){
				context.runner.killCurrentTask()
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
	}),

	purge: cmd({
		description: context => context.formatter.purgeDescription(),
		handler: (context, command) => {
			context.queue.clear()
			if(context.runner.currentRunningTask){
				context.runner.killCurrentTask()
			}
			return {reply: context.formatter.purgeCompleted(command)}
		},
		reacts: displayQueueReact
	}),

	clear: cmd({
		description: context => context.formatter.clearDescription(),
		handler: (context, command) => {
			context.queue.clear()
			return {reply: context.formatter.clearCompleted(command)}
		},
		reacts: displayQueueReact
	}),

	kill: cmd({
		description: context => context.formatter.killDescription(),
		handler: (context, command) => {
			const currentTask = context.runner.currentRunningTask
			if(currentTask){
				context.runner.killCurrentTask()
				return {reply: context.formatter.killSuccess(command, currentTask)}
			} else {
				return {
					reply: context.formatter.killTaskNotFound(command),
					isRefuse: true
				}
			}
		},
		reacts: displayQueueReact
	}),

	dreamrepeat: cmd({
		description: context => context.formatter.dreamrepeatDescription(),
		handler: (context, command) => {
			const task = context.cmdParser.getLastQueryOfUser(command.userId)
			if(!task){
				return {
					reply: context.formatter.dreamrepeatNoPreviousFound(command),
					isRefuse: true
				}
			}
			return startGen(context, task)
		}
	})
}

export type CommandName = keyof typeof _commands

export const commands = _commands as {readonly [name in CommandName]: CommandDef}

// just for typecasting
function cmd<P extends string, R extends CommandResult>(def: CommandDef<R, P>): CommandDef<R, P> {
	return def
}