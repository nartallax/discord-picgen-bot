import {commands} from "bot_commands"
import {BotError} from "bot_error"
import {AppContext} from "context"
import * as Discord from "discord.js"
import {errToString} from "utils"

export type DefaultInteraction = Discord.ChatInputCommandInteraction<Discord.CacheType>
export type InteractionHandler = (interaction: DefaultInteraction, context: AppContext) => (void | Promise<void>)

type SimpleCommandArr = [string, string, InteractionHandler]
type ComplexCommandArr = [ReturnType<Discord.SlashCommandBuilder["toJSON"]>, InteractionHandler]
export type CommandArr = SimpleCommandArr | ComplexCommandArr

function isSimpleCommandArr(x: CommandArr): x is SimpleCommandArr {
	return typeof(x[0]) === "string"
}

export class Bot {

	private readonly client: Discord.Client
	private readonly rest: Discord.REST

	getTextChannel(id: string): Discord.TextBasedChannel {
		const channel = this.client.channels.cache.get(id)
		if(!channel || !channel.isTextBased()){
			throw new Error("Discord channel " + id + " is not accessible for bot, or is not text-based channel.")
		}
		return channel
	}

	constructor(readonly context: AppContext, readonly token: string) {
		this.client = new Discord.Client({
			intents: [
				Discord.GatewayIntentBits.Guilds
			]
		})

		this.rest = new Discord.REST({
			version: "10"
		}).setToken(this.token)
	}

	async start(): Promise<void> {
		await this.login()
		const cmdObjects = commands.map(cmdArr => {
			if(isSimpleCommandArr(cmdArr)){
				return new Discord.SlashCommandBuilder()
					.setName(cmdArr[0])
					.setDescription(cmdArr[1])
					.toJSON()
			}
			return cmdArr[0]
		})
		await this.rest.put(
			Discord.Routes.applicationGuildCommands(this.context.config.clientID, this.context.config.guildID),
			{body: cmdObjects}
		)
		this.listen()
	}

	private login(): Promise<void> {
		return new Promise((ok, bad) => {
			this.client.once("ready", () => ok())
			this.client.once("error", e => bad(e))
			this.client.login(this.token)
		})
	}

	private listen(): void {
		this.client.on("interactionCreate", async interaction => {
			if(!interaction.isChatInputCommand()){
				return
			}

			const cmdArr = commands.find(x =>
				(isSimpleCommandArr(x) ? x[0] : x[0].name) === interaction.commandName
			)
			if(!cmdArr){
				console.error("Skipping command " + interaction.commandName + ": it's not for me")
				return
			}
			const commandAction = isSimpleCommandArr(cmdArr) ? cmdArr[2] : cmdArr[1]
			try {
				await Promise.resolve(commandAction(interaction, this.context))
			} catch(e){
				let msg: string
				if(e instanceof BotError){
					msg = e.message
				} else {
					msg = "Oh noes! Something failed UwU! We awe sowwy. Go look into logs."
					console.error(errToString(e))
				}

				this.reportError(msg, interaction.channelId, interaction)
			}
		})
	}

	reportError(errorMsg: string, channelId: string, interaction?: DefaultInteraction): void {
		try {
			if(interaction && !interaction.replied){
				interaction.reply(errorMsg)
			} else {
				const channel = interaction?.channel || this.getTextChannel(channelId)
				channel.send(errorMsg)
			}
		} catch(e){
			console.error("Failed to report error " + errorMsg)
			console.error("Because of " + (e instanceof Error ? e.stack || e.message : e + ""))
		}
	}

}