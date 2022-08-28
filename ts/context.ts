import {GenQueue} from "gen_queue"
import {Config} from "types"
import {Bot} from "bot"
import {PictureManager} from "picture_manager"
import {Scheduler} from "scheduler"
import {StaticFormatter} from "formatters/static_formatter"
import {LastCommandRepo} from "last_command_repo"

export interface AppContext {
	config: Config
	readonly queue: GenQueue
	readonly bot: Bot
	readonly formatter: StaticFormatter
	readonly pictureManager: PictureManager
	readonly scheduler: Scheduler
	readonly lastCommandRepo: LastCommandRepo
}

export function createAppContext(config: Config, token: string): AppContext {
	let queue: GenQueue | null = null
	let bot: Bot | null = null
	let formatter: StaticFormatter | null = null
	let scheduler: Scheduler | null = null
	const pictureManager = new PictureManager(config.tempPicturesDirectory)
	const lastCommandRepo = new LastCommandRepo()
	const context: AppContext = {
		config,
		get queue() {
			return queue ||= new GenQueue(context)
		},
		get bot() {
			return bot ||= new Bot(context, token)
		},
		get formatter() {
			return formatter ||= new StaticFormatter(context)
		},
		get scheduler() {
			return scheduler ||= new Scheduler(context)
		},
		pictureManager,
		lastCommandRepo
	}
	void context.bot, context.formatter, context.scheduler
	return context
}