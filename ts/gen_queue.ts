import {AppContext} from "context"
import {GenTask} from "types"
import {errToString} from "utils"

export class GenQueue {

	constructor(private readonly context: AppContext) {}

	private arr: GenTask[] = []

	put(input: GenTask): void {
		this.arr.push(input)
		this.tryStart()
	}

	private get(): GenTask | undefined {
		const first = this.arr[0]
		this.arr = this.arr.splice(1)
		return first
	}

	clear(): void {
		this.arr.length = 0
	}

	drop(id: number): GenTask | undefined {
		let result: GenTask | undefined = undefined
		this.arr = this.arr.filter(x => {
			if(x.id === id){
				result = x
				return false
			}
			return true
		})
		return result
	}

	* [Symbol.iterator](): IterableIterator<GenTask> {
		for(const item of this.arr){
			yield item
		}
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