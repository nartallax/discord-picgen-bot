import {CommandMessageProperties, CommandResult} from "bot"
import {MapQueue} from "map_queue"

interface StoredInteraction {
	readonly msg: CommandMessageProperties
	readonly timeAdded: number
	readonly reply: CommandResult
}

export class InteractionStorage {
	private readonly queue = new MapQueue<string, StoredInteraction>()

	constructor(private readonly timeoutSeconds: number) {}

	add(id: string, msg: CommandMessageProperties, reply: CommandResult): void {
		this.queue.enqueue(id, {msg, reply, timeAdded: Date.now()})
		this.cleanup()
	}

	get(id: string): StoredInteraction | undefined {
		return this.queue.get(id)
	}

	cleanup(): void {
		const limit = Date.now() - (this.timeoutSeconds * 1000)
		this.queue.deleteWhile((_, interaction) => interaction.timeAdded < limit)
	}
}