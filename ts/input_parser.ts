import {DefaultInteraction} from "bot"
import {BotError} from "bot_error"
import {Config} from "types"

export interface GenerationInput {
	readonly prompt: string
	readonly paramsPassedByHuman: readonly string[]
	readonly params: ParamValuesObject
	readonly id: number
	readonly channelId: string
}

export function genInputToString(input: GenerationInput, config: Config): string {
	const lengthLimit = Math.max(3, config.promptCutoffLimitInDisplay || 50)
	const shortPrompt = input.prompt.length > lengthLimit
		? input.prompt.substring(0, lengthLimit - 3) + "..."
		: input.prompt
	return `#${input.id}: ${shortPrompt}`
}

type ParamValue = GenerationParamDescriptionValueType<GenerationParamDescription>
type ParamValuesObject = Record<string, ParamValue>

export type GenerationParamDescription = GenerationStringParamDescription | GenerationNumberParamDescription | GenerationBoolParamDescription | GenerationEnumParamDescription

interface GenerationParamDescriptionBase<T> {
	readonly key: string | readonly string[]
	readonly jsonName: string
	readonly description?: string
	readonly default?: T
	readonly humanName?: string
}

type GenerationParamDescriptionValueType<T> = T extends GenerationParamDescriptionBase<infer V> ? V : null

interface GenerationStringParamDescription extends GenerationParamDescriptionBase<string> {
	readonly type: "string"
}

interface GenerationEnumParamDescription extends GenerationParamDescriptionBase<string> {
	readonly type: "enum"
	readonly allowedValues: string[]
}

interface GenerationNumberParamDescription extends GenerationParamDescriptionBase<number> {
	readonly type: "int" | "float"
}

interface GenerationBoolParamDescription extends GenerationParamDescriptionBase<boolean> {
	readonly type: "bool"
}

let inputId = 0

export class GenParamParser {
	private defMap = new Map<string, GenerationParamDescription>()

	constructor(defs: readonly GenerationParamDescription[]) {
		for(const def of defs){
			if(typeof(def.key) === "string"){
				this.registerParam(def.key, def)
			} else {
				for(const key of def.key){
					this.registerParam(key, def)
				}
			}
		}
	}

	private registerParam(key: string, def: GenerationParamDescription) {
		const oldDef = this.defMap.get(key)
		if(oldDef && oldDef !== def){
			throw new Error(`Bad config! There are two parameters with key ${key}: "${oldDef.jsonName}" and "${def.jsonName}". This won't work well! Fix that.`)
		}
		this.defMap.set(key, def)
	}

	parse(paramStr: string, interaction: DefaultInteraction): GenerationInput {
		const {prompt, paramsArr} = this.split(paramStr)
		const params = this.parseParams(paramsArr)
		const paramsPassedByHuman = Object.keys(params)
		this.checkAndUseDefaults(params)
		const id = ++inputId
		return {prompt, params, id, channelId: interaction.channelId, paramsPassedByHuman}
	}

	private split(paramStr: string): {prompt: string, paramsArr: readonly string[]} {
		const rawParamParts = paramStr.split(/\s+/)
		const firstKeyIndex = rawParamParts.findIndex(part => this.defMap.has(part))
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

	private parseParams(params: readonly string[]): ParamValuesObject {
		const usedParams = new Set<GenerationParamDescription>()
		const result = {} as ParamValuesObject
		for(let i = 0; i < params.length; i++){
			const key = params[i]!
			const def = this.defMap.get(key)
			if(!def){
				// should never happen
				throw new BotError("No param is defined for key " + key)
			}
			if(usedParams.has(def)){
				throw new BotError("One of parameters is defined twice, last time with key " + key)
			}

			let value: ParamValue
			if(def.type === "bool"){
				value = true
			} else {
				const rawValue = params[++i]
				if(typeof(rawValue) !== "string"){
					throw new BotError("Expected a value after key " + key)
				}

				switch(def.type){
					case "string":
						value = rawValue
						break
					case "float":
					case "int":
						value = parseFloat(rawValue)
						if(Number.isNaN(value) || !Number.isFinite(value)){
							throw new BotError(`Expected some numeric value after key ${key}, got something else instead: "${rawValue}"`)
						}
						if(def.type === "int" && !Number.isInteger(value)){
							throw new BotError(`Expected integer number value after key ${key}, but this value has fractional part: "${rawValue}"`)
						}
						break
					case "enum":
						value = rawValue
						if(!def.allowedValues.find(x => x === value)){
							throw new BotError(`Value ${value} is not one of allowed values of parameter ${key}.`)
						}
						break
				}
			}
			result[def.jsonName] = value
		}

		return result
	}

	private checkAndUseDefaults(params: ParamValuesObject): void {
		for(const def of new Set([...this.defMap.values()])){
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

			const keyString = typeof(def.key) === "string" ? def.key : def.key.join(" / ")
			throw new BotError(`No value is provided for parameter ${keyString}, and it has no default. Cannot continue without this value.`)
		}
	}

	makeHelpStr(): string {
		const result = [] as [string, string][]
		let longestKeys = 0
		for(const def of new Set([...this.defMap.values()])){
			let keyStr = typeof(def.key) === "string" ? def.key : def.key.join(", ")
			keyStr += " (" + def.type + ")"
			longestKeys = Math.max(longestKeys, keyStr.length)
			let valueStr = ""
			if(def.default && def.type !== "bool"){
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