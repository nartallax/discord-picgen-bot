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
import {displayQueueReact, repeatReact, saveMessageReact, starMessageReact} from "commands/bot_commands"
import {CommandResult} from "bot"
import {GenerationFormatter} from "formatters/generation_formatter"

type OutputLine = GeneratedFileLine | ErrorLine | ExpectedPicturesLine | MessageLine | UpdatedPromptLine

export type TaskCommandResult = CommandResult & {
	task: GenTaskInput
	starred?: boolean
	saved?: boolean
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

interface MessageLine {
	message: string
}
function isMessageLine(line: OutputLine): line is MessageLine {
	return typeof((line as MessageLine).message) === "string"
}

interface ExpectedPicturesLine {
	willGenerateCount: number
}
function isExpectedPicturesLine(line: OutputLine): line is ExpectedPicturesLine {
	return typeof((line as ExpectedPicturesLine).willGenerateCount) === "number"
}

interface UpdatedPromptLine {
	updatedPrompt: string
}
function isUpdatedPromptLine(line: OutputLine): line is UpdatedPromptLine {
	return typeof((line as UpdatedPromptLine).updatedPrompt) === "string"
}

export class GenRunner {

	constructor(private readonly context: AppContext,
		private readonly genFormatter: GenerationFormatter
	) {}

	async runAndOutput(task: GenTask): Promise<void> {
		task.startTime = Date.now()
		await this.run(task)
	}

	private async sendTaskMessage(task: GenTask, msg: string | undefined): Promise<Discord.Message | null> {
		if(task.isSilent){
			return null
		}
		return await this.context.bot.mbSend(task.channelId, msg)
	}

	private async sendResult(task: GenTask, line: GeneratedFileLine): Promise<void> {
		task.generatedPictures = (task.generatedPictures || 0) + 1
		const pictureIndex = task.generatedPictures
		let content: Buffer
		try {
			content = await Fs.readFile(line.generatedPicture)
		} catch(e){
			if(task.isSilent){
				return
			}
			if(isEnoent(e)){
				await this.context.bot.mbSend(
					task.channelId,
					this.genFormatter.outputPictureNotFound(task, line.generatedPicture)
				)
			} else {
				await this.context.bot.mbSend(
					task.channelId,
					this.genFormatter.failedToReadOutputPicture(task, line.generatedPicture)
				)
				console.error(errToString(e))
			}
			return
		}

		try {
			const pictureGeneratedText = this.genFormatter.outputPicture({
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
			if(message && !task.isSilent){
				const saveMessage = this.context.config.savedPropmtsChannelID ? saveMessageReact : null
				const starMessage = this.context.config.starredPromptsChannelID ? starMessageReact : null
				if(saveMessage || starMessage){
					this.context.bot.addReactsToMessage(
						message,
						task.command,
						this.getFakeCommandResult(task, pictureGeneratedText),
						{
							...(saveMessage || {}),
							...(starMessage || {})
						}
					)
				}
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
		const replyStr = this.genFormatter.generationCompleted(task)
		const message = await this.sendTaskMessage(task, replyStr)
		if(message){
			this.context.bot.addReactsToMessage(
				message,
				task.command,
				this.getFakeCommandResult(task, replyStr),
				{
					...displayQueueReact,
					...repeatReact
				}
			)
		}

		await Promise.all(task.inputImages.map(picture =>
			this.context.pictureManager.deleteImage(picture)
		))
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
				} else if(isMessageLine(line)){
					await this.sendTaskMessage(task, line.message)
				} else if(isGeneratedFileLine(line)){
					await this.sendResult(task, line)
				} else if(isExpectedPicturesLine(line)){
					task.totalExpectedPictures = line.willGenerateCount
				} else if(isUpdatedPromptLine(line)){
					task.prompt = line.updatedPrompt
				} else {
					console.error("Unknown action in line " + lineStr + ". Skipping it.")
				}
			})
		})
	}

	private makeCommand(task: GenTask): {bin: string, params: readonly string[], inputJson: string} {
		const json = JSON.stringify({
			prompt: task.prompt,
			roleName: task.roleName,
			...task.params,
			paramsPassedByHuman: task.paramsPassedByHuman,
			inputPictures: task.inputImages
		})
		const entries = ShellQuote.parse(this.genFormatter.genCmd.commandTemplate, {
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

}