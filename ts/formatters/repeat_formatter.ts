import {AppContext} from "context"
import {CommandPropsShort, Formatter} from "formatters/formatter"
import {RepeatCommandDescription} from "types"

export class RepeatFormatter extends Formatter {



	constructor(context: AppContext, private readonly repeatCmd: RepeatCommandDescription) {
		super(context)
	}

	noPreviousFound(cmd: CommandPropsShort): string | undefined {
		return this.format(this.repeatCmd.text?.noPreviousFound, this.makeCommandParams(cmd))
	}

	description(): string | undefined {
		return this.format(this.repeatCmd.text?.description, {})
	}


}