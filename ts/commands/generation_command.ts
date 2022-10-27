import {CommandDef} from "bot"
import {displayQueueReact, startGen, StartGenResult} from "commands/bot_commands"
import {AppContext} from "context"
import {GenerationFormatter} from "formatters/generation_formatter"
import {GenRunner} from "gen_runner"
import {InputParser} from "input_parser"
import {GenerationCommandDescription} from "types"

export function makeGenerationCommand(context: AppContext, commandName: string, description: GenerationCommandDescription): CommandDef {

	const formatter = new GenerationFormatter(context, description)
	const runner = new GenRunner(context, formatter)
	const parser = new InputParser(context, description, commandName)

	return {
		description: () => formatter.description(),
		params: {
			params: {
				type: "string",
				description: () => formatter.paramDescription(),
				required: true
			}
		},
		reacts: {
			"🔫": (context, reaction) => {
				const taskId = (reaction.commandResult as StartGenResult).taskId
				if(taskId){
					context.bot.runCommand({
						roleName: context.bot.getRoleName(reaction.reactUserId),
						command: "drop",
						options: {task_id: taskId},
						channelId: reaction.channelId,
						messageId: reaction.messageId,
						userId: reaction.reactUserId
					})
				}
			},
			...displayQueueReact
		},
		handler: async(context, command) => {
			const paramsStr = command.options.params
			if(typeof(paramsStr) !== "string"){
				return {
					reply: formatter.noParams(command),
					isRefuse: true
				}
			}
			const task = await parser.parse(command, paramsStr, command)
			return startGen(context, task, formatter, runner)
		}
	}
}