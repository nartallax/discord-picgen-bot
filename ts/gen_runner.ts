import {BotError} from "bot_error"
import {GenerationInput} from "generation_input"
import * as ShellQuote from "shell-quote"
import * as ChildProcess from "child_process"
import * as ReadLine from "readline"

export interface GenTask {
	readonly input: GenerationInput
	readonly outputFiles: string[]
	readonly errors: string[]
	exitCode?: number
}

type OutputLine = GeneratedFileLine | ErrorLine

interface GeneratedFileLine {
	generatedPicture: string
}
function isGeneratedFileLine(line: OutputLine): line is GeneratedFileLine {
	return typeof((line as GeneratedFileLine).generatedPicture) === "string"
}

interface ErrorLine {
	error: string
}
function isErrorLine(line: OutputLine): line is ErrorLine {
	return typeof((line as ErrorLine).error) === "string"
}

export class GenRunner {
	constructor(private readonly commandTemplate: string) {}

	async run(input: GenerationInput): Promise<GenTask> {
		const {bin, params, inputJson} = this.makeCommand(input)

		const task: GenTask = {
			errors: [],
			input,
			outputFiles: []
		}

		const process = ChildProcess.spawn(bin, params, {
			stdio: ["inherit", "pipe", "inherit"]
		})

		const exitPromise = new Promise<void>(ok => {
			process.on("exit", code => {
				if(typeof(code) === "number"){
					task.exitCode = code
				}
				ok()
			})
		})

		process.on("error", err => {
			console.error("Process errored (launched with params " + inputJson + "): " + err)
		})

		const reader = ReadLine.createInterface(process.stdout)
		reader.on("line", lineStr => {
			if(!lineStr.startsWith("{")){
				return
			}
			let line: OutputLine
			try {
				line = JSON.parse(lineStr)
			} catch(e){
				console.error("Failed to parse json-like line " + lineStr + ". Skipping it.")
				return
			}

			if(isErrorLine(line)){
				task.errors.push(line.error)
			} else if(isGeneratedFileLine(line)){
				task.outputFiles.push(line.generatedPicture)
			} else {
				console.error("Unknown action in line " + lineStr + ". Skipping it.")
			}
		})

		await exitPromise

		return task
	}

	private makeCommand(input: GenerationInput): {bin: string, params: readonly string[], inputJson: string} {
		const json = JSON.stringify({
			prompt: input.prompt,
			...input.params
		})
		const entries = ShellQuote.parse(this.commandTemplate, {
			INPUT_JSON: json
		})

		for(const entry of entries){
			if(typeof(entry) !== "string"){
				throw new BotError("Bad configuration: weird generation command template. Some part of it parsed as " + JSON.stringify(entry) + ", and I don't know how to launch that.")
			}
		}

		if(entries.length === 0){
			throw new BotError("Bad configuration: weird generation command template. Expected to have at least one command part.")
		}

		const bin = entries[0] as string
		const params = entries.slice(1) as string[]
		return {bin, params, inputJson: json}
	}
}