import {CommandName, commands} from "bot_commands"
import {BotError} from "bot_error"
import {AppContext} from "context"
import * as Discord from "discord.js"
import {InteractionStorage} from "interaction_storage"
import {errToString} from "utils"

type DefaultInteraction = Discord.ChatInputCommandInteraction<Discord.CacheType>
export type InteractionHandler = (interaction: DefaultInteraction, context: AppContext) => (void | Promise<void>)

type Async<T> = T | Promise<T>
export interface CommandResult {
	readonly reply: string | undefined
	readonly isRefuse?: boolean
}

export interface CommandMessageProperties<P extends string = string> {
	readonly channelId: string
	readonly userId: string
	readonly command: string
	readonly options: CommandOptionsObject<P>
}

interface OptBase {
	setName(name: string): unknown
	setDescription(description: string): unknown
	setRequired(flag: true): unknown
}

export type CommandOptionsObject<P extends string = string> = {readonly [key in P]: number | string}

interface CommandReactHandlerOptions<P extends string = string, R extends CommandResult = CommandResult> {
	readonly commandResult: R
	readonly reactUserId: string
	readonly commandMessage: CommandMessageProperties<P>
}

export type CommandDef<R extends CommandResult = CommandResult, P extends string = string> = {
	description(context: AppContext): string | undefined
	readonly params?: {
		readonly [name in P]: {
			readonly type: "string" | "number"
			description(context: AppContext): string | undefined
			readonly required?: true
		}
	}
	readonly reacts?: {
		readonly [emote: string]: (context: AppContext, opts: CommandReactHandlerOptions<P, R>) => Async<void>
	}
	handler(context: AppContext, opts: CommandMessageProperties<P>): Async<R>
}

export class Bot {

	private readonly client: Discord.Client
	private readonly rest: Discord.REST
	private readonly commandStorage: InteractionStorage

	getTextChannel(id: string): Discord.TextBasedChannel {
		const channel = this.client.channels.cache.get(id)
		if(!channel || !channel.isTextBased()){
			throw new Error("Discord channel " + id + " is not accessible for bot, or is not text-based channel.")
		}
		return channel
	}

	constructor(readonly context: AppContext, readonly token: string) {
		this.commandStorage = new InteractionStorage(context.config.reactionWaitingTimeSeconds || 86400)

		this.client = new Discord.Client({
			intents: [
				Discord.GatewayIntentBits.Guilds,
				Discord.GatewayIntentBits.GuildMessages,
				Discord.GatewayIntentBits.GuildMessageReactions
			],
			partials: [
				Discord.Partials.Message,
				Discord.Partials.Channel,
				Discord.Partials.Reaction
			]
		})

		this.rest = new Discord.REST({
			version: "10"
		}).setToken(this.token)
	}

	async start(): Promise<void> {
		await this.login()
		const cmdObjects = [] as ReturnType<Discord.SlashCommandBuilder["toJSON"]>[]
		for(const name in commands){
			const def = commands[name as CommandName]
			const builder = new Discord.SlashCommandBuilder()
			builder.setName(name)
			const description = def.description(this.context)
			console.log({name})
			if(description){
				console.log({cmdDesc: description})
				builder.setDescription(description)
			}
			if(def.params){
				for(const paramName in def.params){
					console.log({paramName})
					const param = def.params[paramName]!
					const optBuilder = <T extends OptBase>(opt: T) => {
						opt.setName(paramName)
						const description = param.description(this.context)
						if(description){
							console.log({paramDesc: description})
							opt.setDescription(description)
						}
						if(param.required){
							opt.setRequired(true)
						}
						return opt
					}

					switch(param.type){
						case "string":
							builder.addStringOption(optBuilder)
							break
						case "number":
							builder.addNumberOption(optBuilder)
							break
					}
				}
			}
			cmdObjects.push(builder.toJSON())
		}
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
		this.client.on("interactionCreate", interaction => {
			if(!interaction.isChatInputCommand()){
				return
			}

			this.processInteraction(interaction)
		})

		this.client.on("messageReactionAdd", async(reaction, user) => {
			this.processReaction(reaction, user)
		})
	}

	private async processReaction(reaction: Discord.MessageReaction | Discord.PartialMessageReaction, user: Discord.User | Discord.PartialUser): Promise<void> {
		if(user.bot){
			return
		}

		const command = this.commandStorage.get(reaction.message.id)
		if(!command){
			return
		}

		const commandDef = commands[command.msg.command as CommandName]
		if(!commandDef){
			return
		}

		const reactHandler = commandDef.reacts?.[reaction.emoji.name || ""]
		if(!reactHandler){
			return
		}

		const reactOpts: CommandReactHandlerOptions = {
			commandResult: command.reply,
			commandMessage: command.msg,
			reactUserId: user.id
		}
		await Promise.resolve(reactHandler(this.context, reactOpts))
	}

	private async processInteraction(interaction: DefaultInteraction): Promise<void> {
		const opts = extractOptions(interaction)
		await this.runCommand({
			channelId: interaction.channelId,
			command: interaction.commandName,
			options: opts,
			userId: interaction.user.id
		}, interaction)
	}

	async runCommand(msg: CommandMessageProperties, interaction?: DefaultInteraction): Promise<void> {
		const def = commands[msg.command as CommandName]
		if(!def){
			return
		}

		let reply: CommandResult
		let replyMessage: Discord.Message
		try {
			reply = await Promise.resolve(def.handler(this.context, msg))
			replyMessage = await this.replyOrSend(msg.channelId, {content: reply.reply}, interaction)
			this.commandStorage.add(replyMessage.id, msg, reply)
		} catch(e){
			let errMsg: string
			if(e instanceof BotError){
				errMsg = e.message
			} else {
				errMsg = "Oh noes! Something failed UwU! We awe sowwy. Go look into logs."
				console.error(errToString(e))
			}

			this.reportError(errMsg, msg.channelId, interaction)
			return
		}

		if(def.reacts && !reply.isRefuse){
			for(const emote in def.reacts){
				replyMessage.react(emote)
			}
		}
	}

	async mbSend(channelId: string, message: string | {content?: string, files?: {name: string, data: Buffer}[]} | undefined, interaction?: DefaultInteraction): Promise<void> {
		const msg: {content?: string, files?: Discord.AttachmentBuilder[]} = {}
		if(message === undefined){
			return
		}
		if(typeof(message) === "string"){
			if(!message){
				return
			}
			msg.content = message
		} else {
			if(!message.content && (!message.files || message.files.length === 0)){
				return
			}
			msg.content = message.content
			if(message.files){
				msg.files = message.files.map(({name, data}) => new Discord.AttachmentBuilder(
					data, {name}
				))
			}
		}
		await this.replyOrSend(channelId, msg, interaction)
	}

	private async replyOrSend(channelId: string, message: {content?: string, files?: Discord.AttachmentBuilder[]}, interaction?: DefaultInteraction): Promise<Discord.Message> {
		try {
			if(interaction && !interaction.replied){
				return await interaction.reply({...message, fetchReply: true})
			} else {
				const channel = interaction?.channel || this.getTextChannel(channelId)
				return await channel.send(message)
			}
		} catch(e){
			this.reportError(errToString(e), channelId, interaction)
			throw e
		}
	}

	reportError(errorMsg: string, channelId: string, interaction?: DefaultInteraction): void {
		try {
			this.replyOrSend(channelId, {content: errorMsg}, interaction)
		} catch(e){
			console.error("Failed to report error " + errorMsg)
			console.error("Because of " + (e instanceof Error ? e.stack || e.message : e + ""))
		}
	}

}

function extractOptions(interaction: DefaultInteraction): CommandOptionsObject {
	const optionsObj: Record<string, string | number> = {}
	for(const item of interaction.options.data){
		if(typeof(item.value) === "string" || typeof(item.value) === "number"){
			optionsObj[item.name] = item.value
		}
	}
	return optionsObj
}