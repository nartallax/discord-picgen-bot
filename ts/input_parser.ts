import {BotError} from "bot_error"
import {AppContext} from "context"
import {httpGet} from "http_utils"
import {GenTaskInputWithoutId} from "last_command_repo"
import {GenParamDescription, GenParamValue, GenParamValuesObject, GenTaskInput, CommandMessageProperties, GenerationCommandDescription} from "types"
import * as ShellQuote from "shell-quote"

export class InputParser {
	private genParams: ReadonlyMap<string, GenParamDescription>

	private readonly privateParamName: string | undefined
	private readonly silentParamName: string | undefined

	constructor(private readonly context: AppContext, private readonly cmd: GenerationCommandDescription, private readonly commandName: string) {
		this.genParams = makeGenParamMap(cmd)

		const privateParam = cmd.params.find(x => x.type === "bool" && x.role === "private")
		this.privateParamName = privateParam?.jsonName

		const silentParam = cmd.params.find(x => x.type === "bool" && x.role === "silent")
		this.silentParamName = silentParam?.jsonName
	}

	async parse(command: CommandMessageProperties, paramStr: string, msg: CommandMessageProperties): Promise<GenTaskInput> {
		const {prompt: rawPrompt, paramsArr} = this.split(paramStr)
		const [params, originalKeyValuePairs] = this.parseParams(paramsArr, command)
		const [prompt, droppedWords] = this.dropExcessWords(rawPrompt)

		const inputImages = await this.loadInputImages(msg)
		const paramsPassedByHuman = Object.keys(params)
		this.checkAndUseDefaults(params, command)
		const isPrivate = !this.privateParamName ? false : !!params[this.privateParamName]
		const isSilent = !this.silentParamName ? false : !!params[this.silentParamName]
		const result: GenTaskInputWithoutId = {prompt, params, channelId: msg.channelId, paramsPassedByHuman, rawInputString: paramStr, rawParamString: paramsArr.join(" "), userId: msg.userId, droppedPromptWordsCount: droppedWords, isPrivate, isSilent, originalKeyValuePairs, inputImages, command, commandDescription: this.cmd, roleName: command.roleName ?? null}

		return this.context.lastCommandRepo.put(this.commandName, result)
	}

	private async loadInputImages(msg: CommandMessageProperties): Promise<string[]> {
		return await Promise.all((msg.attachments || []).map(async attachment => {
			if(!attachment.contentType?.startsWith("image/")){
				throw new BotError(this.context.formatter.errorAttachmentNotPicture(msg))
			}
			const data = await httpGet(attachment.url)
			const storedImage = await this.context.pictureManager.storeImage(attachment.contentType, data)
			return storedImage
		}))

	}

	private dropExcessWords(prompt: string): [string, number] {
		const maxWordCount = this.cmd.prompt?.maxWordCount
		if(!maxWordCount){
			return [prompt, 0]
		}
		let words = prompt.split(/[\s\t\r\n]+/g)
		const droppedCount = Math.max(0, words.length - maxWordCount)
		if(droppedCount > 0){
			words = words.slice(0, maxWordCount)
			prompt = words.join(" ")
		}
		return [prompt, droppedCount]
	}

	// one logic for separating prompt from parameters
	// another logic (shellquoting) is for parsing parameters
	// that's why this method exists
	private reparseParams(str: readonly string[]): string[] {
		const parseResult = ShellQuote.parse(str.join(" "))
		const result = [] as string[]
		for(const part of parseResult){
			if(typeof(part) !== "string"){
				console.error("Unparseable: ", parseResult)
				throw new BotError("Cannot parse params: unexpected expressions found.")
			}
			result.push(part)
		}
		return result
	}

	private split(paramStr: string): {prompt: string, paramsArr: readonly string[]} {
		const rawParamParts = paramStr.split(/\s/)
		const firstKeyIndex = rawParamParts.findIndex(part => this.genParams.has(part))
		let promptParts: string[], paramParts: string[]
		if(firstKeyIndex < 0){
			promptParts = rawParamParts
			paramParts = []
		} else {
			promptParts = rawParamParts.slice(0, firstKeyIndex)
			paramParts = this.reparseParams(rawParamParts.slice(firstKeyIndex))
		}

		return {prompt: promptParts.join(" "), paramsArr: paramParts}
	}

	private parseParams(params: readonly string[], command: CommandMessageProperties): [GenParamValuesObject, [key: string, value: GenParamValue][]] {
		const originalKeyValuePairs = [] as [key: string, value: GenParamValue][]
		const usedParams = new Set<GenParamDescription>()
		const result = {} as GenParamValuesObject
		for(let i = 0; i < params.length; i++){
			const key = params[i]!
			const def = this.genParams.get(key)
			if(!def){
				throw new BotError(this.context.formatter.errorUnknownParam(key, command))
			}
			if(usedParams.has(def)){
				throw new BotError(this.context.formatter.errorDuplicateParamPassed(key, command))
			}

			let value: GenParamValue
			if(def.type === "bool"){
				value = true
			} else {
				const rawValue = params[++i]
				if(typeof(rawValue) !== "string"){
					throw new BotError(this.context.formatter.errorNoValueAfterParam(key, command))
				}

				switch(def.type){
					case "string":
						value = rawValue
						break
					case "float":
					case "int":
						value = parseFloat(rawValue)
						if(Number.isNaN(value) || !Number.isFinite(value)){
							throw new BotError(this.context.formatter.errorParamNotNumber(key, rawValue, command))
						}
						if(def.type === "int" && !Number.isInteger(value)){
							throw new BotError(this.context.formatter.errorParamNotInteger(key, rawValue, command))
						}
						break
					case "enum":
						value = rawValue
						if(!def.allowedValues.find(x => x === value)){
							throw new BotError(this.context.formatter.errorParamNotInAllowedList(key, rawValue, command))
						}
						break
				}
			}
			originalKeyValuePairs.push([key, value])
			result[def.jsonName] = value
		}

		return [result, originalKeyValuePairs]
	}

	private checkAndUseDefaults(params: GenParamValuesObject, command: CommandMessageProperties): void {
		for(const def of new Set([...this.genParams.values()])){
			if(def.jsonName in params){
				continue
			}
			if(def.type === "bool"){
				params[def.jsonName] = false
				continue
			}
			if(def.default !== undefined){
				params[def.jsonName] = def.default
				continue
			}

			const keyString = allKeysOfGenParam(def).join(" / ")
			throw new BotError(this.context.formatter.errorRequiredParamNotPassed(keyString, command))
		}
	}

}

export function visibleKeysOfGenParam(def: GenParamDescription): readonly string[] {
	return typeof(def.key) === "string" ? [def.key] : def.key
}

export function allKeysOfGenParam(def: GenParamDescription): string[] {
	return [
		...visibleKeysOfGenParam(def),
		...(def.keyHidden === undefined ? [] : typeof(def.keyHidden) === "string" ? [def.keyHidden] : def.keyHidden)
	]
}

function makeGenParamMap(cmd: GenerationCommandDescription): ReadonlyMap<string, GenParamDescription> {
	const genParams = new Map<string, GenParamDescription>()
	for(const def of cmd.params){
		const keys = allKeysOfGenParam(def)
		for(const key of keys){
			const oldDef = genParams.get(key)
			if(oldDef && oldDef !== def){
				throw new Error(`Bad config! There are two parameters with key ${key}: "${oldDef.jsonName}" and "${def.jsonName}". This won't work well! Fix that.`)
			}
			genParams.set(key, def)
		}
	}
	return genParams
}