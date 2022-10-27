import {AppContext} from "context"
import {Config, GenParamDescription, GenTask, CommandMessageProperties} from "types"
import {toFixedNoTrailingZeroes} from "utils"

type DropUndef<T> = T extends undefined ? never : T
export type CommandPropsShort = {
	userId: CommandMessageProperties["userId"]
	command?: CommandMessageProperties["command"]
}

export abstract class Formatter {

	protected get t(): DropUndef<Config["text"]> {
		return this.context.config.text || {}
	}

	constructor(protected readonly context: AppContext) {}

	protected formatFileSize(size: number): string {
		if(size < 1024){
			return size + "b"
		}
		size /= 1024
		if(size < 1024){
			return toFixedNoTrailingZeroes(size, 2) + "kb"
		}
		size /= 1024
		return toFixedNoTrailingZeroes(size, 2) + "mb"
	}

	protected makeCommandParams(command: CommandPropsShort): {readonly [k: string]: string} {
		return {
			COMMAND: command.command || "???",
			USER: this.formatUserMention(command.userId)
		}
	}

	protected makeTaskParams(task: GenTask): {readonly [k: string]: string} {
		const lengthLimit = Math.max(3, this.context.config.promptCutoffLimitInDisplay || 50)
		const shortPrompt = task.prompt.length > lengthLimit
			? task.prompt.substring(0, lengthLimit - 3) + "..."
			: task.prompt
		return {
			TASK_ID: task.id + "",
			USER_INPUT_RAW: task.rawParamString,
			PICTURES_EXPECTED: (task.totalExpectedPictures ?? "???") + "",
			PICTURES_GENERATED: (task.generatedPictures || 0) + "",
			PARAMS_NICE: this.paramsToNiceString(task, true, task.commandDescription.params),
			PARAMS_NICE_FULL: this.paramsToNiceString(task, false, task.commandDescription.params),
			PARAMS_BY_KEYS_NICE: this.origParamsWithKeysToNiceString(task),
			USER: this.formatUserMention(task.userId),
			PROMPT: task.prompt,
			PROMPT_SHORT: shortPrompt,
			TIME_PASSED: this.formatTimePassed(task),
			DROPPED_PROMPT_WORDS_COUNT: task.droppedPromptWordsCount + "",
			PROMPT_WORDS_LIMIT: (task.commandDescription.prompt?.maxWordCount || 0) + ""
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

	protected formatTimeSpan(timeSpanInSeconds: number): string {
		const seconds = Math.round(timeSpanInSeconds % 60)
		timeSpanInSeconds = (timeSpanInSeconds - seconds) / 60
		const minutes = timeSpanInSeconds % 60
		timeSpanInSeconds = (timeSpanInSeconds - minutes) / 60
		const hours = timeSpanInSeconds
		return hours
			? `${hours}:${td(minutes)}:${td(seconds)}`
			: `${minutes}:${td(seconds)}`
	}

	protected paramsToNiceString(task: GenTask, onlyUserPassed: boolean, allParams: readonly GenParamDescription[]): string {
		const params = this.jsonNamesOfTaskParams(task, onlyUserPassed, allParams)
		const paramMap = new Map(allParams.map(x => [x.jsonName, x]))
		const result = params.map(name => {
			const def = paramMap.get(name)
			if(!def){
				return null
			}
			let value = task.params[name] + ""
			if(value.includes(" ")){
				value = JSON.stringify(value)
			}
			return (def.humanName || def.jsonName) + ": " + value
		}).filter(x => !!x).join("\n")
		return result
	}

	protected origParamsWithKeysToNiceString(task: GenTask): string {
		return task.originalKeyValuePairs.map(([key, value]) => {
			if(value === true){
				return key
			} else {
				let str = value + ""
				if(str.includes(" ")){
					str = JSON.stringify(str)
				}
				return key + " " + str
			}
		}).join("\n")
	}

	protected format(template: string | string[], params: {readonly [k: string]: string}): string
	protected format(template: string | string[] | undefined, params: {readonly [k: string]: string}): string | undefined
	protected format(template: string | string[] | undefined, params: {readonly [k: string]: string}): string | undefined {
		if(Array.isArray(template)){
			if(template.length === 0){
				template = undefined
			} else {
				template = template[Math.floor(Math.random() * template.length)]
			}
		}
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

	protected selectPrivatePublic(task: GenTask, templatePair: {readonly public?: string | string[], readonly private?: string | string[]} | undefined): string | string[] | undefined {
		return !templatePair
			? undefined
			: !task.isPrivate
				? templatePair.public
				: templatePair.private || templatePair.public
	}

	protected formatUserMention(userId: string): string {
		return `<@${userId}>`
	}

	protected jsonNamesOfTaskParams(task: GenTask, onlyUserPassed: boolean, allParams: readonly GenParamDescription[]): readonly string[] {
		return onlyUserPassed
			? task.paramsPassedByHuman
			: allParams.map(x => x.jsonName)
	}

}

const td = (x: number) => (x > 9 ? "" : "0") + x