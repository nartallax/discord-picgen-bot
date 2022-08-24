import {AppContext} from "context"
import {GenRunner} from "gen_runner"
import {GenTask} from "types"
import {errToString} from "utils"

export class GenQueue {

	private currentTask: GenTask | null = null

	get currentRunningTask(): GenTask | null {
		return this.currentTask
	}

	constructor(private readonly context: AppContext) {}

	private arr: [GenTask, GenRunner][] = []

	put(input: GenTask, runner: GenRunner): void {
		this.arr.push([input, runner])
		this.tryStart()
	}

	private get(): [GenTask, GenRunner] | undefined {
		const first = this.arr[0]
		this.arr = this.arr.splice(1)
		return first
	}

	clear(): void {
		this.arr.length = 0
	}

	drop(id: number): GenTask | undefined {
		let result: GenTask | undefined = undefined
		this.arr = this.arr.filter(([task]) => {
			if(task.id === id){
				result = task
				return false
			}
			return true
		})
		return result
	}

	* [Symbol.iterator](): IterableIterator<GenTask> {
		for(const [task] of this.arr){
			yield task
		}
	}

	async tryStart(): Promise<void> {
		if(this.currentTask){
			return
		}
		const input = this.get()
		if(!input){
			return
		}
		const [task, runner] = input
		try {
			this.currentTask = task
			await runner.runAndOutput(task)
		} catch(e){
			this.context.bot.reportError(errToString(e), task.channelId)
		} finally {
			this.currentTask = null
			this.tryStart()
		}
	}

	killCurrentTask(): void {
		if(!this.currentTask || !this.currentTask.process){
			throw new Error("Cannot kill current task: no task or process!")
		}

		this.currentTask.process.kill()
	}

}