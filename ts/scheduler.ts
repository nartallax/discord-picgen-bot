import {AppContext} from "context"
import {CommandMessageProperties} from "types"

interface TaskWithMask extends CommandMessageProperties {
	timeMask: RegExp[]
}

export class Scheduler {

	private lastCheckedDate: string | null = null
	private readonly tasks: readonly TaskWithMask[]
	private interval: unknown | null = null

	constructor(private readonly context: AppContext) {
		this.tasks = (context.config.repeatedTasks || []).map(item => {
			return {
				...item,
				timeMask: item.timeMask.map(mask => new RegExp(mask))
			}
		})
	}

	start(): void {
		if(!this.interval){
			this.interval = setInterval(() => this.check(), 15000)
		}
	}

	stop(): void {
		if(this.interval){
			clearInterval(this.interval as number)
			this.interval = null
		}
	}

	private check(): void {
		const timeStr = formatDate(new Date())
		if(timeStr === this.lastCheckedDate){
			return
		}
		this.lastCheckedDate = timeStr

		for(const task of this.tasks){
			const mask = task.timeMask.find(mask => mask.test(timeStr))
			if(!mask){
				continue
			}

			this.context.bot.runCommand(task)
		}
	}

}

function formatDate(date: Date): string {
	return `${date.getFullYear()}.${td(date.getMonth() + 1)}.${td(date.getDate())} ${td(date.getHours())}:${td(date.getMinutes())}`
}

const td = (x: number) => (x > 9 ? "" : "0") + x