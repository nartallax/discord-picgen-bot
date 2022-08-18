import {makeCommands} from "bot_commands"
import {BotError} from "bot_error"
import * as Discord from "discord.js"
import {Config} from "types"

type InteractionHandler = (interaction: Discord.ChatInputCommandInteraction<Discord.CacheType>) => (void | Promise<void>)

type SimpleCommandArr = [string, string, InteractionHandler]
type ComplexCommandArr = [ReturnType<Discord.SlashCommandBuilder["toJSON"]>, InteractionHandler]
type CommandArr = SimpleCommandArr | ComplexCommandArr

function isSimpleCommandArr(x: CommandArr): x is SimpleCommandArr {
	return typeof(x[0]) === "string"
}


export class Bot {

	private readonly client: Discord.Client
	private readonly rest: Discord.REST
	private readonly commands: readonly CommandArr[]

	constructor(readonly config: Config, readonly token: string) {
		this.client = new Discord.Client({
			intents: [
				Discord.GatewayIntentBits.Guilds,
				Discord.GatewayIntentBits.MessageContent
			]
		})

		this.commands = makeCommands(config)

		this.rest = new Discord.REST({
			version: "10"
		}).setToken(this.token)
	}

	async start(): Promise<void> {
		await this.login()
		const cmdObjects = this.commands.map(cmdArr => {
			if(isSimpleCommandArr(cmdArr)){
				return new Discord.SlashCommandBuilder()
					.setName(cmdArr[0])
					.setDescription(cmdArr[1])
					.toJSON()
			}
			return cmdArr[0]
		})
		await this.rest.put(
			Discord.Routes.applicationGuildCommands(this.config.clientID, this.config.guildID),
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

			const cmdArr = this.commands.find(x =>
				(isSimpleCommandArr(x) ? x[0] : x[0].name) === interaction.commandName
			)
			if(!cmdArr){
				console.error("Skipping command " + interaction.commandName + ": it's not for me")
				return
			}
			const commandAction = isSimpleCommandArr(cmdArr) ? cmdArr[2] : cmdArr[1]
			try {
				await Promise.resolve(commandAction(interaction))
			} catch(e){
				if(e instanceof BotError){
					interaction.reply(e.message)
				} else {
					interaction.reply("Oh noes! Something failed UwU! We awe sowwy. Go look into logs.")
					console.error(e instanceof Error ? e.stack || e.message : e + "")
				}
			}
		})
	}

}