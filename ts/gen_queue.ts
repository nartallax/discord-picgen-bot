import {AppContext} from "context"
import {GenerationInput, genInputToString} from "input_parser"
import {errToString} from "utils"

export class GenQueue {

	constructor(private readonly context: AppContext) {}

	private arr: GenerationInput[] = []

	put(input: GenerationInput): void {
		this.arr.push(input)
		this.tryStart()
	}

	private get(): GenerationInput | undefined {
		const first = this.arr[0]
		this.arr = this.arr.splice(1)
		return first
	}

	clear(): void {
		this.arr.length = 0
	}

	drop(id: number): boolean {
		const oldLen = this.arr.length
		this.arr = this.arr.filter(x => x.id !== id)
		return oldLen !== this.arr.length
	}

	showItems(): string {
		return this.arr.map(item => genInputToString(item, this.context.config)).join("\n")
	}

	async tryStart(): Promise<void> {
		if(this.context.runner.isTaskRunning()){
			return
		}
		const input = this.get()
		if(!input){
			return
		}
		try {
			this.context.runner.runAndOutput(input)
		} catch(e){
			this.context.bot.reportError(errToString(e), input.channelId)
		}
	}

}