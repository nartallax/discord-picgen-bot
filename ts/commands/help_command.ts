import {CommandDef} from "bot"
import {AppContext} from "context"
import {HelpFormatter} from "formatters/help_formatter"
import {HelpCommandDescription} from "types"

export function makeHelpCommand(context: AppContext, description: HelpCommandDescription): CommandDef {

	const genCmd = context.config.commands[description.for]
	if(!genCmd || genCmd.type !== "generation"){
		throw new Error(`Cannot found command "${description.for}", or it is not generation command.`)
	}

	const formatter = new HelpFormatter(context, description, genCmd)

	return {
		description: () => formatter.description(),
		handler: (_, command) => {
			let str = formatter.helpParamsStr()
			const header = formatter.helpHeader(command)
			str = (header ? header + "\n\n" : "") + str
			return {reply: "```\n" + str + "\n```"}
		}
	}
}
