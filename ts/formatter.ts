import {AppContext} from "context"
import {allKeysOfGenParam} from "input_parser"
import {Config, GenParamDescription, GenTask, CommandMessageProperties} from "types"
import {toFixedNoTrailingZeroes} from "utils"

type DropUndef<T> = T extends undefined ? never : T
type CommandPropsShort = {
	userId: CommandMessageProperties["userId"]
	command?: CommandMessageProperties["command"]
}

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
		if(task.isSilent){
			return undefined
		}
		return this.outputPictureFormat(this.select(task, this.t.dream?.outputPictureNotFound), task, fileName)
	}

	dreamFailedToReadOutputPicture(task: GenTask, fileName: string): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.outputPictureFormat(this.select(task, this.t.dream?.outputPictureNotFound), task, fileName)
	}

	dreamOutputPicture(task: GenTask, fileName: string): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.outputPictureFormat(this.select(task, this.t.dream?.outputPicture), task, fileName)
	}

	dreamGenerationCompleted(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.dream?.generationCompleted), this.makeTaskParams(task))
	}

	dreamNewTaskCreated(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.dream?.newTaskCreated), this.makeTaskParams(task))
	}

	dreamPromptWordsDroppedOnTaskCreation(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.dream?.promptWordsDroppedOnTaskCreation), this.makeTaskParams(task))
	}

	dreamNoParams(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.dream?.noParams, this.makeCommandParams(cmd))
	}

	statusRunningTask(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.status?.runningTask), this.makeTaskParams(task))
	}

	statusQueuedTask(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.status?.queuedTask), this.makeTaskParams(task))
	}

	statusRunningTaskPrefix(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.status?.runningTasksPrefix, this.makeCommandParams(cmd))
	}

	statusQueuedTaskPrefix(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.status?.queuedTasksPrefix, this.makeCommandParams(cmd))
	}

	statusNoTasks(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.status?.noTasks, this.makeCommandParams(cmd))
	}

	dropNoTaskId(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.drop?.noTaskId, this.makeCommandParams(cmd))
	}

	dropKilledRunningTask(cmd: CommandPropsShort, task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.drop?.killedRunningTask), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	dropDequeuedTask(cmd: CommandPropsShort, task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.drop?.dequeuedTask), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	dropTaskNotFound(cmd: CommandPropsShort, taskId: number): string | undefined {
		return this.format(this.t.drop?.taskNotFound, {
			...this.makeCommandParams(cmd),
			TASK_ID: taskId + ""
		})
	}

	dreamhelpHeader(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.dreamhelp?.header, this.makeCommandParams(cmd))
	}

	purgeCompleted(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.purge?.completed, this.makeCommandParams(cmd))
	}

	clearCompleted(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.clear?.completed, this.makeCommandParams(cmd))
	}

	killSuccess(cmd: CommandPropsShort, task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.select(task, this.t.kill?.success), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	killTaskNotFound(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.kill?.taskNotFound, this.makeCommandParams(cmd))
	}

	dreamrepeatNoPreviousFound(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.dreamrepeat?.noPreviousFound, this.makeCommandParams(cmd))
	}

	dreamDescription(): string | undefined {
		return this.format(this.t.dream?.description, {})
	}

	dreamhelpDescription(): string | undefined {
		return this.format(this.t.dreamhelp?.description, {})
	}

	dreamrepeatDescription(): string | undefined {
		return this.format(this.t.dreamrepeat?.description, {})
	}

	dropDescription(): string | undefined {
		return this.format(this.t.drop?.description, {})
	}

	killDescription(): string | undefined {
		return this.format(this.t.kill?.description, {})
	}

	purgeDescription(): string | undefined {
		return this.format(this.t.purge?.description, {})
	}

	clearDescription(): string | undefined {
		return this.format(this.t.clear?.description, {})
	}

	statusDescription(): string | undefined {
		return this.format(this.t.status?.description, {})
	}

	dreamParamDescription(): string | undefined {
		return this.format(this.t.dream?.paramDescription, {})
	}

	dropTaskIdDescription(): string | undefined {
		return this.format(this.t.drop?.taskIdDescription, {})
	}

	lenny(): string {
		return this.format(dflt(this.t.lenny, "( ͡° ͜ʖ ͡°)"), {})
	}

	errorParamNotNumber(paramName: string, paramValue: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.paramNotNumber, "Was expecting number as value of parameter $PARAM_NAME, got $PARAM_VALUE instead"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramName,
				PARAM_VALUE: paramValue
			}
		)
	}

	errorBadConfigLaunchCommandTooComplex(partJson: string, task: GenTask): string {
		return this.format(
			dflt(this.t.errors?.badConfigLaunchCommandTooComplex, "Bad configuration: weird generation command template. Some part of it parsed as $PART_JSON, and I don't know how to launch that."),
			{
				...this.makeTaskParams(task),
				PART_JSON: partJson
			}
		)
	}

	errorBadConfigNoCommandParts(task: GenTask): string {
		return this.format(
			dflt(this.t.errors?.badConfigNoCommandParts, "Bad configuration: weird generation command template. Expected to have at least one command part."),
			this.makeTaskParams(task)
		)
	}

	errorAttachmentNotPicture(command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.attachmentNotPicture, "One of the attachments is not picture; can't process."),
			this.makeCommandParams(command)
		)
	}

	errorDuplicateParamPassed(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.duplicateParamPassed, "One of parameters is defined twice, last time with key $PARAM_KEY"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}

	errorNoValueAfterParam(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.noValueAfterParam, "Expected a value after key $PARAM_KEY"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}
	errorParamNotInteger(paramKey: string, paramValue: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.paramNotInteger, "Expected integer number value after key $PARAM_KEY, but this value has fractional part: $PARAM_VALUE"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey,
				PARAM_VALUE: paramValue
			}
		)
	}

	errorParamNotInAllowedList(paramKey: string, paramValue: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.paramNotInAllowedList, "Value $PARAM_VALUE is not one of allowed values of parameter $PARAM_KEY."),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey,
				PARAM_VALUE: paramValue
			}
		)
	}

	errorRequiredParamNotPassed(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.requiredParamNotPassed, "No value is provided for parameter $PARAM_KEY, and it has no default. Cannot continue without this value."),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}

	errorUnknownParam(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.unknownParam, "No param is defined for key $PARAM_KEY"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}

	errorPictureTooLarge(size: number, task: GenTask): string {
		return this.format(
			dflt(this.t.errors?.pictureTooLarge, "Cannot upload picture $PICTURES_GENERATED / $PICTURES_EXPECTED: it is too large ($IMAGE_SIZE)"),
			{
				...this.makeTaskParams(task),
				IMAGE_SIZE: this.formatFileSize(size)
			}
		)
	}

	errorCannotResolveGuild(guildId: string): string {
		return this.format(
			dflt(this.t.errors?.cannotResolveGuild, "Cannot get guild $GUILD_ID!"),
			{
				GUILD_ID: guildId
			}
		)
	}

	errorCannotResolveMember(userId: string): string {
		return this.format(
			dflt(this.t.errors?.cannotResolveMember, "Cannot get member $USER_ID!"),
			{
				USER_ID: userId
			}
		)
	}

	errorActionNotAllowed(action: string, userId: string): string {
		return this.format(
			dflt(this.t.errors?.actionNotAllowed, "Hey $USER, you cannot do $ACTION!"),
			{
				USER: this.formatUserMention(userId),
				ACTION: action
			}
		)
	}

	savedPrompt(task: GenTask): string | undefined {
		return this.format(this.t.savedPrompt, this.makeTaskParams(task))
	}

	starredPrompt(task: GenTask): string | undefined {
		return this.format(this.t.starredPrompt, this.makeTaskParams(task))
	}

	private formatFileSize(size: number): string {
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

	private outputPictureFormat(template: string | string[] | undefined, task: GenTask, fileName: string): string | undefined {
		return this.format(template, {
			...this.makeTaskParams(task),
			GENERATED_PICTURE_PATH: fileName
		})
	}

	private makeCommandParams(command: CommandPropsShort): {readonly [k: string]: string} {
		return {
			COMMAND: command.command || "???",
			USER: this.formatUserMention(command.userId)
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
			USER: this.formatUserMention(task.userId),
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

	private format(template: string | string[], params: {readonly [k: string]: string}): string
	private format(template: string | string[] | undefined, params: {readonly [k: string]: string}): string | undefined
	private format(template: string | string[] | undefined, params: {readonly [k: string]: string}): string | undefined {
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

	private select(task: GenTask, templatePair: {readonly public?: string | string[], readonly private?: string | string[]} | undefined): string | string[] | undefined {
		return !templatePair
			? undefined
			: !task.isPrivate
				? templatePair.public
				: templatePair.private || templatePair.public
	}

	private formatUserMention(userId: string): string {
		return `<@${userId}>`
	}

}

const td = (x: number) => (x > 9 ? "" : "0") + x

function dflt(x: string | string[] | undefined, deflt: string): string | string[] {
	if(!x){
		return deflt
	}
	if(Array.isArray(x) && x.length < 1){
		return deflt
	}
	return x
}