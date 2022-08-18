import {BotError} from "bot_error"
import {GenerationInput, genInputToString} from "input_parser"
import * as ShellQuote from "shell-quote"
import * as ChildProcess from "child_process"
import * as ReadLine from "readline"
import * as Discord from "discord.js"
import * as Path from "path"
import {promises as Fs} from "fs"
import {Readable} from "stream"
import {AppContext} from "context"
import {errToString, isEnoent} from "utils"

export interface GenTask {
	readonly startTime: number
	readonly input: GenerationInput
	exitCode?: number
	process?: ChildProcess.ChildProcessByStdio<null, Readable, null>
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

	private currentTask: GenTask | null = null

	get currentRunningTask(): GenTask | null {
		return this.currentTask
	}

	constructor(private readonly context: AppContext) {
		// this should throw error on bad template
		this.makeCommand({
			prompt: "", params: {}, id: 0, channelId: "", paramsPassedByHuman: []
		})
	}

	async runAndOutput(input: GenerationInput): Promise<void> {
		const task: GenTask = {
			input,
			startTime: Date.now()
		}

		try {
			this.currentTask = task
			await this.run(task)
		} finally {
			this.currentTask = null
			this.context.queue.tryStart()
		}
	}

	private sendTaskMessage(task: GenTask, msg: string): Promise<void> {
		return this.sendWithChannel(task, channel => {
			channel.send(msg)
		})
	}

	private sendResult(task: GenTask, line: GeneratedFileLine): Promise<void> {
		return this.sendWithChannel(task, async channel => {
			let content: Buffer
			try {
				content = await Fs.readFile(line.generatedPicture)
			} catch(e){
				if(isEnoent(e)){
					channel.send("Output file not found: " + line.generatedPicture)
				} else {
					channel.send("Failed to read output file " + line.generatedPicture)
					console.error(errToString(e))
				}
				return
			}

			const attachment = new Discord.AttachmentBuilder(content, {
				name: Path.basename(line.generatedPicture)
			})

			channel.send({files: [attachment]})
		})
	}

	private async sendWithChannel(task: GenTask, callback: (channel: Discord.TextBasedChannel) => void | Promise<void>): Promise<void> {
		try {
			const channel = this.context.bot.getTextChannel(task.input.channelId)
			await Promise.resolve(callback(channel))
		} catch(e){
			this.context.bot.reportError(errToString(e), task.input.channelId)
		}
	}

	private async run(task: GenTask): Promise<void> {

		const {bin, params, inputJson} = this.makeCommand(task.input)

		const process = task.process = ChildProcess.spawn(bin, params, {
			stdio: ["inherit", "pipe", "inherit"]
		})

		const exitPromise = new Promise<void>(ok => {
			process.on("exit", code => {
				console.error("Generator process exited with code " + code)
				if(typeof(code) === "number"){
					task.exitCode = code
				}
				this.sendTaskMessage(task, `Generation #${task.input.id} completed in ${Math.ceil((Date.now() - task.startTime) / 1000)}s`)
				ok()
			})
		})

		process.on("error", err => {
			console.error("Process errored (launched with params " + inputJson + "): " + err)
		})

		this.addStdoutParser(task)

		await exitPromise
	}

	isTaskRunning(): boolean {
		return !!this.currentTask
	}

	describeCurrentTask(): string {
		return !this.currentTask ? "" : genInputToString(this.currentTask.input, this.context.config)
	}

	private addStdoutParser(task: GenTask): void {
		if(!task.process){
			throw new Error("Cannot parse stdout of task: no process is created")
		}
		const reader = ReadLine.createInterface(task.process.stdout)
		reader.on("line", lineStr => {
			if(!lineStr.startsWith("{")){
				// console.error("Unrecognized stdout line. First characters are: " + lineStr.substring(0, 5).split("").map(x => x.charCodeAt(0) + " (" + x + ")"))
				console.error(lineStr)
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
				this.sendTaskMessage(task, line.error)
			} else if(isGeneratedFileLine(line)){
				this.sendResult(task, line)
			} else {
				console.error("Unknown action in line " + lineStr + ". Skipping it.")
			}
		})
	}

	private makeCommand(input: GenerationInput): {bin: string, params: readonly string[], inputJson: string} {
		const json = JSON.stringify({
			prompt: input.prompt,
			...input.params
		})
		const entries = ShellQuote.parse(this.context.config.commandTemplate, {
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

	killCurrentTask(): void {
		if(!this.currentTask || !this.currentTask.process){
			throw new Error("Cannot kill current task: no task or process!")
		}

		this.currentTask.process.kill()
	}

}