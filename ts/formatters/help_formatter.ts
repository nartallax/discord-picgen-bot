import {AppContext} from "context"
import {CommandPropsShort, Formatter} from "formatters/formatter"
import {allKeysOfGenParam, visibleKeysOfGenParam} from "input_parser"
import {GenerationCommandDescription, GenParamDescription, HelpCommandDescription} from "types"

export class HelpFormatter extends Formatter {
	private readonly params: readonly GenParamDescription[]
	private readonly keyToJsonNameMap: Map<string, string>

	constructor(context: AppContext, private readonly helpCmd: HelpCommandDescription, genCmd: GenerationCommandDescription) {
		super(context)

		this.params = genCmd.params

		this.keyToJsonNameMap = new Map()
		this.params.forEach(def => {
			allKeysOfGenParam(def).forEach(key => {
				this.keyToJsonNameMap.set(key, def.jsonName)
			})
		})
	}

	helpHeader(cmd: CommandPropsShort): string {
		return this.format(this.helpCmd.text?.header, this.makeCommandParams(cmd)) || ""
	}

	description(): string {
		return this.format(this.helpCmd.text?.description, {}) || ""
	}

	helpParamsStr(): string {
		const result = [] as [string, string][]
		let longestKeys = 0
		for(const def of this.params){
			let keyStr = visibleKeysOfGenParam(def).join(", ")
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