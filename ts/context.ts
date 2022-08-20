import {GenParamParser} from "input_parser"
import {GenQueue} from "gen_queue"
import {GenRunner} from "gen_runner"
import {Config} from "types"
import {Bot} from "bot"
import {Formatter} from "formatter"

export interface AppContext {
	readonly config: Config
	readonly runner: GenRunner
	readonly cmdParser: GenParamParser
	readonly queue: GenQueue
	readonly bot: Bot
	readonly formatter: Formatter
}

export function createAppContext(config: Config, token: string): AppContext {
	let cmdParser: GenParamParser | null = null
	let runner: GenRunner | null = null
	let queue: GenQueue | null = null
	let bot: Bot | null = null
	let formatter: Formatter | null = null
	const context: AppContext = {
		config,
		get cmdParser() {
			return cmdParser ||= new GenParamParser(context)
		},
		get runner() {
			return runner ||= new GenRunner(context)
		},
		get queue() {
			return queue ||= new GenQueue(context)
		},
		get bot() {
			return bot ||= new Bot(context, token)
		},
		get formatter() {
			return formatter ||= new Formatter(context)
		}
	}
	void context.cmdParser, context.runner, context.bot, context.formatter
	return context
}