import {CommandMessageProperties} from "bot"
import {AppContext} from "context"
import {allKeysOfGenParam} from "input_parser"
import {Config, GenParamDescription, GenTask} from "types"

type DropUndef<T> = T extends undefined ? never : T

export class Formatter {
	private readonly paramMap: Map<string, GenParamDescription>
	private readonly keyToJsonNameMap: Map<string, string>
	private readonly t: DropUndef<Config["text"]>

	constructor(private readonly context: AppContext) {
		this.paramMap = new Map(this.context.config.params.map(x => [x.jsonName, x]))

		this.keyToJsonNameMap = new Map()
		this.context.config.params.forEach(def => {
			allKeysOfGenParam(def).forEach(key => {
				this.keyToJsonNameMap.set(key, def.jsonName)
			})
		})

		this.t = context.config.text || {}
	}

	dreamOutputPictureNotFound(task: GenTask, fileName: string): string | undefined {
		return this.outputPictureFormat(this.select(task, this.t.dream?.outputPictureNotFound), task, fileName)
	}

	dreamFailedToReadOutputPicture(task: GenTask, fileName: string): string | undefined {
		return this.outputPictureFormat(this.select(task, this.t.dream?.outputPictureNotFound), task, fileName)
	}

	dreamOutputPicture(task: GenTask, fileName: string): string | undefined {
		return this.outputPictureFormat(this.select(task, this.t.dream?.outputPicture), task, fileName)
	}

	dreamGenerationCompleted(task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.dream?.generationCompleted), this.makeTaskParams(task))
	}

	dreamNewTaskCreated(task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.dream?.newTaskCreated), this.makeTaskParams(task))
	}

	dreamPromptWordsDroppedOnTaskCreation(task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.dream?.promptWordsDroppedOnTaskCreation), this.makeTaskParams(task))
	}

	dreamNoParams(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.dream?.noParams, this.makeCommandParams(cmd))
	}

	statusRunningTask(task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.status?.runningTask), this.makeTaskParams(task))
	}

	statusQueuedTask(task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.status?.queuedTask), this.makeTaskParams(task))
	}

	statusRunningTaskPrefix(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.status?.runningTasksPrefix, this.makeCommandParams(cmd))
	}

	statusQueuedTaskPrefix(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.status?.queuedTasksPrefix, this.makeCommandParams(cmd))
	}

	statusNoTasks(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.status?.noTasks, this.makeCommandParams(cmd))
	}

	dropNoTaskId(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.drop?.noTaskId, this.makeCommandParams(cmd))
	}

	dropKilledRunningTask(cmd: CommandMessageProperties, task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.drop?.killedRunningTask), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	dropDequeuedTask(cmd: CommandMessageProperties, task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.drop?.dequeuedTask), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	dropTaskNotFound(cmd: CommandMessageProperties, taskId: number): string | undefined {
		return this.format(this.t.drop?.taskNotFound, {
			...this.makeCommandParams(cmd),
			TASK_ID: taskId + ""
		})
	}

	dreamhelpHeader(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.dreamhelp?.header, this.makeCommandParams(cmd))
	}

	purgeCompleted(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.purge?.completed, this.makeCommandParams(cmd))
	}

	clearCompleted(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.clear?.completed, this.makeCommandParams(cmd))
	}

	killSuccess(cmd: CommandMessageProperties, task: GenTask): string | undefined {
		return this.format(this.select(task, this.t.kill?.success), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	killTaskNotFound(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.kill?.taskNotFound, this.makeCommandParams(cmd))
	}

	dreamrepeatNoPreviousFound(cmd: CommandMessageProperties): string | undefined {
		return this.format(this.t.dreamrepeat?.noPreviousFound, this.makeCommandParams(cmd))
	}

	dreamDescription(): string | undefined {
		return this.t.dream?.description
	}

	dreamhelpDescription(): string | undefined {
		return this.t.dreamhelp?.description
	}

	dreamrepeatDescription(): string | undefined {
		return this.t.dreamrepeat?.description
	}

	dropDescription(): string | undefined {
		return this.t.drop?.description
	}

	killDescription(): string | undefined {
		return this.t.kill?.description
	}

	purgeDescription(): string | undefined {
		return this.t.purge?.description
	}

	clearDescription(): string | undefined {
		return this.t.clear?.description
	}

	statusDescription(): string | undefined {
		return this.t.status?.description
	}

	dreamParamDescription(): string | undefined {
		return this.t.dream?.paramDescription
	}

	dropTaskIdDescription(): string | undefined {
		return this.t.drop?.taskIdDescription
	}

	private outputPictureFormat(template: string | undefined, task: GenTask, fileName: string): string | undefined {
		return this.format(template, {
			...this.makeTaskParams(task),
			GENERATED_PICTURE_PATH: fileName
		})
	}

	private makeCommandParams(command: CommandMessageProperties): {readonly [k: string]: string} {
		return {
			COMMAND: command.command,
			USER: `<@${command.userId}>`
		}
	}

	private makeTaskParams(task: GenTask): {readonly [k: string]: string} {
		const lengthLimit = Math.max(3, this.context.config.promptCutoffLimitInDisplay || 50)
		const shortPrompt = task.prompt.length > lengthLimit
			? task.prompt.substring(0, lengthLimit - 3) + "..."
			: task.prompt
		return {
			TASK_ID: task.id + "",
			USER_INPUT_RAW: task.rawParamString,
			PICTURES_EXPECTED: (task.totalExpectedPictures ?? "???") + "",
			PICTURES_GENERATED: (task.generatedPictures || 0) + "",
			PARAMS_NICE: this.paramsToNiceString(task, true),
			PARAMS_NICE_FULL: this.paramsToNiceString(task, false),
			PARAMS_BY_KEYS_NICE: this.origParamsWithKeysToNiceString(task),
			USER: `<@${task.userId}>`,
			PROMPT: task.prompt,
			PROMPT_SHORT: shortPrompt,
			TIME_PASSED: this.formatTimePassed(task),
			DROPPED_PROMPT_WORDS_COUNT: task.droppedPromptWordsCount + "",
			PROMPT_WORDS_LIMIT: (this.context.config.maxWordCountInPrompt || 0) + ""
		}
	}

	private formatTimePassed(task: GenTask): string {
		let timePassed = Math.ceil((Date.now() - (task.startTime || 0)) / 1000)
		const seconds = timePassed % 60
		timePassed = (timePassed - seconds) / 60
		const minutes = timePassed % 60
		timePassed = (timePassed - minutes) / 60
		const hours = timePassed
		return hours
			? `${hours}:${td(minutes)}:${td(seconds)}`
			: `${minutes}:${td(seconds)}`
	}

	private paramsToNiceString(task: GenTask, onlyUserPassed: boolean): string {
		const result = this.jsonNamesOfTaskParams(task, onlyUserPassed).map(name => {
			const def = this.paramMap.get(name)
			if(!def){
				return null
			}
			const value = task.params[name] + ""
			return (def.humanName || def.jsonName) + ": " + value
		}).filter(x => !!x).join("\n")
		return result
	}

	private origParamsWithKeysToNiceString(task: GenTask): string {
		return task.originalKeyValuePairs.map(([key, value]) => {
			if(value === true){
				return key
			} else {
				return key + " " + value
			}
		}).join("\n")
	}

	private jsonNamesOfTaskParams(task: GenTask, onlyUserPassed: boolean): readonly string[] {
		return onlyUserPassed
			? task.paramsPassedByHuman
			: this.context.config.params.map(x => x.jsonName)
	}

	private format(template: string | undefined, params: {readonly [k: string]: string}): string | undefined {
		if(!template){
			return undefined
		}
		return template.replace(/\$([A-Z_]+)/g, (_, name) => {
			const param = params[name]
			if(param === undefined){
				throw new Error("Bad template: parameter " + name + " is not known. (template is \"" + template + "\")")
			}
			return param
		})
	}

	private select(task: GenTask, templatePair: {readonly public?: string, readonly private?: string} | undefined): string | undefined {
		return !templatePair
			? undefined
			: !task.isPrivate
				? templatePair.public
				: templatePair.private || templatePair.public
	}
}

const td = (x: number) => (x > 9 ? "" : "0") + x