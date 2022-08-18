import {GenParamParser} from "input_parser"
import {GenQueue} from "gen_queue"
import {GenRunner} from "gen_runner"
import {Config} from "types"
import {Bot} from "bot"

export interface AppContext {
	readonly config: Config
	readonly runner: GenRunner
	readonly cmdParser: GenParamParser
	readonly queue: GenQueue
	readonly bot: Bot
}

export function createAppContext(config: Config, token: string): AppContext {
	const cmdParser = new GenParamParser(config.params)
	let runner: GenRunner | null = null
	let queue: GenQueue | null = null
	let bot: Bot | null = null
	const context: AppContext = {
		config,
		cmdParser,
		get runner() {
			return runner ||= new GenRunner(context)
		},
		get queue() {
			return queue ||= new GenQueue(context)
		},
		get bot() {
			return bot ||= new Bot(context, token)
		}
	}
	return context
}