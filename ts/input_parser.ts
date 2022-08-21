import {CommandMessageProperties} from "bot"
import {BotError} from "bot_error"
import {AppContext} from "context"
import {httpGet} from "http_utils"
import {GenParamDescription, GenParamValue, GenParamValuesObject, GenTaskInput} from "types"

let taskIdCounter = 0

export class GenParamParser {
	private genParams = new Map<string, GenParamDescription>()

	private readonly lastQueryByUser = new Map<string, GenTaskInput>()
	private readonly privateParamName: string | undefined

	constructor(private readonly context: AppContext) {
		for(const def of context.config.params){
			const keys = allKeysOfGenParam(def)
			for(const key of keys){
				this.registerParam(key, def)
			}
		}
		const privateParam = context.config.params.find(x => x.type === "bool" && x.role === "private")
		this.privateParamName = privateParam?.jsonName
	}

	private registerParam(key: string, def: GenParamDescription) {
		const oldDef = this.genParams.get(key)
		if(oldDef && oldDef !== def){
			throw new Error(`Bad config! There are two parameters with key ${key}: "${oldDef.jsonName}" and "${def.jsonName}". This won't work well! Fix that.`)
		}
		this.genParams.set(key, def)
	}

	async parse(command: CommandMessageProperties, paramStr: string, msg: CommandMessageProperties): Promise<GenTaskInput> {
		const {prompt: rawPrompt, paramsArr} = this.split(paramStr)
		const [params, originalKeyValuePairs] = this.parseParams(paramsArr, command)
		const [prompt, droppedWords] = this.dropExcessWords(rawPrompt)

		const inputImages = await this.loadInputImages(msg)
		const paramsPassedByHuman = Object.keys(params)
		this.checkAndUseDefaults(params, command)
		const isPrivate = !this.privateParamName ? false : !!params[this.privateParamName]
		const result: GenTaskInput = {prompt, params, id: 0, channelId: msg.channelId, paramsPassedByHuman, rawInputString: paramStr, rawParamString: paramsArr.join(" "), userId: msg.userId, droppedPromptWordsCount: droppedWords, isPrivate, originalKeyValuePairs, inputImages, command}

		this.lastQueryByUser.set(result.userId, result)

		return this.makeNew(result)
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

	getLastQueryOfUser(userId: string): GenTaskInput | undefined {
		let result = this.lastQueryByUser.get(userId)
		if(result){
			result = this.makeNew(result)
		}
		return result
	}

	private makeNew(input: GenTaskInput): GenTaskInput {
		input = {
			...input,
			id: ++taskIdCounter
		}
		input = JSON.parse(JSON.stringify(input)) // just to be sure
		return input
	}

	private dropExcessWords(prompt: string): [string, number] {
		if(!this.context.config.maxWordCountInPrompt){
			return [prompt, 0]
		}
		let words = prompt.split(/[\s\t\r\n]+/g)
		const droppedCount = Math.max(0, words.length - this.context.config.maxWordCountInPrompt)
		if(droppedCount > 0){
			words = words.slice(0, this.context.config.maxWordCountInPrompt)
			prompt = words.join(" ")
		}
		return [prompt, droppedCount]
	}

	private split(paramStr: string): {prompt: string, paramsArr: readonly string[]} {
		const rawParamParts = paramStr.split(/\s+/)
		const firstKeyIndex = rawParamParts.findIndex(part => this.genParams.has(part))
		let promptParts: string[], paramParts: string[]
		if(firstKeyIndex < 0){
			promptParts = rawParamParts
			paramParts = []
		} else {
			promptParts = rawParamParts.slice(0, firstKeyIndex)
			paramParts = rawParamParts.slice(firstKeyIndex)
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

	makeHelpStr(): string {
		const result = [] as [string, string][]
		let longestKeys = 0
		for(const def of new Set([...this.genParams.values()])){
			let keyStr = visibleKeysOf(def).join(", ")
			keyStr += " (" + def.type + ")"
			longestKeys = Math.max(longestKeys, keyStr.length)
			let valueStr = ""
			if(def.default !== undefined && def.type !== "bool"){
				valueStr += "[" + def.default + "] "
			}
			if(def.description){
				valueStr += def.description + " "
			}
			if(def.type === "enum"){
				valueStr += "(" + def.allowedValues.join(", ") + ") "
			}
			result.push([keyStr, valueStr.trim()])
		}

		return result.map(([k, v]) => {
			return k + new Array(longestKeys - k.length + 1).join(" ") + "\t" + v
		}).join("\n")
	}

}

function visibleKeysOf(def: GenParamDescription): readonly string[] {
	return typeof(def.key) === "string" ? [def.key] : def.key
}

export function allKeysOfGenParam(def: GenParamDescription): string[] {
	return [
		...visibleKeysOf(def),
		...(def.keyHidden === undefined ? [] : typeof(def.keyHidden) === "string" ? [def.keyHidden] : def.keyHidden)
	]
}