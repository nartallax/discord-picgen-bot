import {CommandDef} from "bot"
import {startGen} from "commands/bot_commands"
import {AppContext} from "context"
import {GenerationFormatter} from "formatters/generation_formatter"
import {RepeatFormatter} from "formatters/repeat_formatter"
import {GenRunner} from "gen_runner"
import {RepeatCommandDescription} from "types"

export function makeRepeatCommand(context: AppContext, description: RepeatCommandDescription): CommandDef {

	const repeatFormatter = new RepeatFormatter(context, description)

	const taskUtils = new Map<string, {
		formatter: GenerationFormatter
		runner: GenRunner
	}>()
	for(const genCmdName of description.anyOfLatest){
		const genCmd = context.config.commands[genCmdName]
		if(!genCmd || genCmd.type !== "generation"){
			throw new Error(`Command "${genCmdName}" not found or is not generation command.`)
		}

		const formatter = new GenerationFormatter(context, genCmd)
		const runner = new GenRunner(context, formatter)
		taskUtils.set(genCmdName, {formatter, runner})
	}

	return {
		description: () => repeatFormatter.description(),
		handler: (context, command) => {
			for(const [cmdName, {formatter, runner}] of taskUtils){
				const task = context.lastCommandRepo.get(cmdName, command.userId)
				if(task){
					return startGen(context, task, formatter, runner)
				}
			}
			return {
				reply: repeatFormatter.noPreviousFound(command),
				isRefuse: true
			}
		}
	}
}