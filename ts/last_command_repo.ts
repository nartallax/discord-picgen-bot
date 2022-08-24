import {GenTaskInput} from "types"

let taskIdCounter = 0

export type GenTaskInputWithoutId = Omit<GenTaskInput, "id">

export class LastCommandRepo {

	private readonly map = new Map<string, Map<string, GenTaskInputWithoutId>>()

	put(commandName: string, task: GenTaskInputWithoutId): GenTaskInput {
		let cmdMap = this.map.get(commandName)
		if(!cmdMap){
			cmdMap = new Map()
			this.map.set(commandName, cmdMap)
		}

		cmdMap.set(task.userId, task)
		return this.makeNew(task)
	}

	get(commandName: string, userId: string): GenTaskInput | null {
		const cmdMap = this.map.get(commandName)
		if(!cmdMap){
			return null
		}

		const task = cmdMap.get(userId)
		if(!task){
			return null
		}

		return this.makeNew(task)
	}

	private makeNew(input: GenTaskInputWithoutId): GenTaskInput {
		return JSON.parse(JSON.stringify({
			...input,
			id: ++taskIdCounter
		}))
	}

}