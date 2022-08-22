import {BotError} from "bot_error"
import * as ShellQuote from "shell-quote"
import * as ChildProcess from "child_process"
import * as ReadLine from "readline"
import * as Path from "path"
import * as Discord from "discord.js"
import {promises as Fs} from "fs"
import {AppContext} from "context"
import {errToString, isEnoent} from "utils"
import {GenTask, GenTaskInput, stripNonSerializableDataFromTask} from "types"
import {displayQueueReact, reDreamReact, saveMessageReact} from "bot_commands"
import {CommandResult} from "bot"

type OutputLine = GeneratedFileLine | ErrorLine | ExpectedPicturesLine

export type TaskCommandResult = CommandResult & {
	task: GenTaskInput
}

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

interface ExpectedPicturesLine {
	willGenerateCount: number
}
function isExpectedPicturesLine(line: OutputLine): line is ExpectedPicturesLine {
	return typeof((line as ExpectedPicturesLine).willGenerateCount) === "number"
}

export class GenRunner {

	private currentTask: GenTask | null = null

	get currentRunningTask(): GenTask | null {
		return this.currentTask
	}

	constructor(private readonly context: AppContext) {}

	async runAndOutput(task: GenTask): Promise<void> {
		try {
			task.startTime = Date.now()
			this.currentTask = task
			await this.run(task)
		} finally {
			this.currentTask = null
			this.context.queue.tryStart()
		}
	}

	private async sendTaskMessage(task: GenTask, msg: string | undefined): Promise<Discord.Message | null> {
		return await this.context.bot.mbSend(task.channelId, msg)
	}

	private async sendResult(task: GenTask, line: GeneratedFileLine): Promise<void> {
		task.generatedPictures = (task.generatedPictures || 0) + 1
		const pictureIndex = task.generatedPictures
		let content: Buffer
		try {
			content = await Fs.readFile(line.generatedPicture)
		} catch(e){
			if(isEnoent(e)){
				await this.context.bot.mbSend(
					task.channelId,
					this.context.formatter.dreamOutputPictureNotFound(task, line.generatedPicture)
				)
			} else {
				await this.context.bot.mbSend(
					task.channelId,
					this.context.formatter.dreamFailedToReadOutputPicture(task, line.generatedPicture)
				)
				console.error(errToString(e))
			}
			return
		}

		try {
			const pictureGeneratedText = this.context.formatter.dreamOutputPicture({
				...task,
				generatedPictures: pictureIndex
			}, line.generatedPicture)
			const message = await this.context.bot.mbSend(
				task.channelId,
				{
					content: pictureGeneratedText,
					files: [{name: Path.basename(line.generatedPicture), data: content}]
				}
			)
			if(message && this.context.config.savedPropmtsChannelID){
				this.context.bot.addReactsToMessage(
					message,
					task.command,
					this.getFakeCommandResult(task, pictureGeneratedText),
					saveMessageReact
				)
			}
		} catch(e){
			if(e instanceof Discord.DiscordAPIError && (e.code + "") === "40005"){
				const pictureTooLargeText = this.context.formatter.errorPictureTooLarge(content.length, {
					...task,
					generatedPictures: pictureIndex
				})
				await this.sendTaskMessage(task, pictureTooLargeText)
			} else {
				throw e
			}
		}

		if(this.context.config.deleteFiledAfterUpload){
			await Fs.rm(line.generatedPicture)
		}
	}

	private async run(task: GenTask): Promise<void> {

		const {bin, params, inputJson} = this.makeCommand(task)

		const process = task.process = ChildProcess.spawn(bin, params, {
			stdio: ["inherit", "pipe", "inherit"]
		})

		const exitPromise = new Promise<void>(ok => {
			process.on("exit", code => {
				this.context.bot.withErrorReporting(task.channelId, null, async() => {
					console.error("Generator process exited with code " + code)
					if(typeof(code) === "number"){
						task.exitCode = code
					}
					ok()
					await this.onTaskCompleted(task)
				})
			})
		})

		process.on("error", err => {
			console.error("Process errored (launched with params " + inputJson + "): " + err)
		})

		this.addStdoutParser(task)

		await exitPromise
	}

	private getFakeCommandResult(task: GenTask, reply?: string): TaskCommandResult {
		return {
			task: stripNonSerializableDataFromTask(task),
			reply
		}
	}

	private async onTaskCompleted(task: GenTask): Promise<void> {
		const replyStr = this.context.formatter.dreamGenerationCompleted(task)
		const message = await this.sendTaskMessage(task, replyStr)
		if(message){
			this.context.bot.addReactsToMessage(
				message,
				task.command,
				this.getFakeCommandResult(task, replyStr),
				{
					...displayQueueReact,
					...reDreamReact
				}
			)
		}

		await Promise.all(task.inputImages.map(picture =>
			this.context.pictureManager.deleteImage(picture)
		))
	}

	isTaskRunning(): boolean {
		return !!this.currentTask
	}

	private addStdoutParser(task: GenTask): void {
		if(!task.process){
			throw new Error("Cannot parse stdout of task: no process is created")
		}
		const reader = ReadLine.createInterface(task.process.stdout)
		reader.on("line", lineStr => {
			this.context.bot.withErrorReporting(task.channelId, null, async() => {
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
					await this.sendTaskMessage(task, line.error)
				} else if(isGeneratedFileLine(line)){
					await this.sendResult(task, line)
				} else if(isExpectedPicturesLine(line)){
					task.totalExpectedPictures = line.willGenerateCount
				} else {
					console.error("Unknown action in line " + lineStr + ". Skipping it.")
				}
			})
		})
	}

	private makeCommand(task: GenTask): {bin: string, params: readonly string[], inputJson: string} {
		const json = JSON.stringify({
			prompt: task.prompt,
			...task.params,
			paramsPassedByHuman: task.paramsPassedByHuman,
			inputPictures: task.inputImages
		})
		const entries = ShellQuote.parse(this.context.config.commandTemplate, {
			INPUT_JSON: json
		})

		for(const entry of entries){
			if(typeof(entry) !== "string"){
				throw new BotError(this.context.formatter.errorBadConfigLaunchCommandTooComplex(JSON.stringify(entry), task))
			}
		}

		if(entries.length === 0){
			throw new BotError(this.context.formatter.errorBadConfigNoCommandParts(task))
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