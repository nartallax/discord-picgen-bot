import * as Discord from "discord.js"
import {promises as Fs} from "fs"
import {GenParamParser} from "generation_input"
import {GenRunner} from "gen_runner"
import {Config} from "types"
import * as Path from "path"
import {grouped, isEnoent} from "utils"

type InteractionHandler = (interaction: Discord.ChatInputCommandInteraction<Discord.CacheType>) => (void | Promise<void>)

type SimpleCommandArr = [string, string, InteractionHandler]
type ComplexCommandArr = [ReturnType<Discord.SlashCommandBuilder["toJSON"]>, InteractionHandler]
type CommandArr = SimpleCommandArr | ComplexCommandArr

const maxAttachmentsPerMessage = 10

export function makeCommands(config: Config): CommandArr[] {
	const cmdParser = new GenParamParser(config.params)
	const genRunner = new GenRunner(config.commandTemplate)

	return [

		[
			"lenny", // just for lulz
			"( ͡° ͜ʖ ͡°)",
			interaction => {
				interaction.reply("( ͡° ͜ʖ ͡°)")
			}
		],

		[
			"dreamhelp",
			"Displays help about /dream command",
			interaction => {
				let str = cmdParser.makeHelpStr()
				str = "Usage: /dream prompt [params]\n\n" + str
				interaction.reply("```\n" + str + "\n```")
			}
		],

		[
			new Discord.SlashCommandBuilder()
				.setName("dream")
				.setDescription("Generate a picture by parameters")
				.addStringOption(opt => opt.setName("params").setDescription("A string with a prompt and other parameters"))
				.toJSON(),
			async interaction => {
				const paramsStr = interaction.options.get("params")?.value
				if(typeof(paramsStr) !== "string"){
					interaction.reply("Hey, where's parameters? I need them to generate anything, y'know.")
					return
				}
				const input = cmdParser.parse(paramsStr)
				const taskPromise = genRunner.run(input)
				interaction.reply("Started!")
				const task = await taskPromise
				if(task.exitCode !== 0){
					const errors = task.errors.join("\n") || "<no errors passed from generator>"
					interaction.channel?.send("Generation completed with errors:\n\n" + errors)
				} else {
					const notFoundFiles = [] as string[]
					const errors = [] as string[]

					const attachments = (await Promise.all(task.outputFiles.map(async filePath => {
						let content: Buffer
						try {
							content = await Fs.readFile(filePath)
						} catch(e){
							if(isEnoent(e)){
								notFoundFiles.push(filePath)
							} else {
								errors.push(e + "")
							}
							return null
						}

						return new Discord.AttachmentBuilder(content, {
							name: Path.basename(filePath)
						})
					}))).filter(x => !!x) as Discord.AttachmentBuilder[]

					let msgText = "Generation finished!"
					if(task.outputFiles.length === 0){
						msgText += "\n\nNo files generated."
					}
					if(notFoundFiles.length > 0){
						msgText += "\n\nSome of resulting files are not found: " + notFoundFiles.join(", ")
					}
					if(errors.length > 0){
						msgText += "\n\nSome of resulting files can not be red: " + errors.join(", ")
					}

					for(const attachmentGroup of grouped(attachments, maxAttachmentsPerMessage)){
						interaction.channel?.send({
							content: msgText,
							files: attachmentGroup
						})
						msgText = ""
					}
				}
			}
		]
	]
}