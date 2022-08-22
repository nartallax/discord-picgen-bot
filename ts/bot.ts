import {CommandName, commands} from "bot_commands"
import {BotError} from "bot_error"
import {AppContext} from "context"
import * as Discord from "discord.js"
import {httpGet} from "http_utils"
import {InteractionStorage} from "interaction_storage"
import {errToString} from "utils"

type DefaultInteraction = Discord.ChatInputCommandInteraction<Discord.CacheType>
export type InteractionHandler = (interaction: DefaultInteraction, context: AppContext) => (void | Promise<void>)

type Async<T> = T | Promise<T>
export interface CommandResult {
	readonly reply: string | undefined
	readonly isRefuse?: boolean
}

interface MessageAttachment {
	readonly url: string
	readonly contentType: string | null
}

export interface AttachmentWithData {
	readonly name: string
	readonly data: Buffer
}

export interface CommandMessageProperties<P extends string = string> {
	readonly channelId: string
	readonly userId: string
	readonly command: string
	readonly options: CommandOptionsObject<P>
	readonly attachments?: readonly MessageAttachment[]
}

interface OptBase {
	setName(name: string): unknown
	setDescription(description: string): unknown
	setRequired(flag: true): unknown
}

export interface MessageReacts<P extends string = string, R extends CommandResult = CommandResult> {
	readonly [emote: string]: (context: AppContext, opts: CommandReactHandlerOptions<P, R>) => Async<void>
}

export type CommandOptionsObject<P extends string = string> = {readonly [key in P]: number | string}

interface CommandReactHandlerOptions<P extends string = string, R extends CommandResult = CommandResult> {
	readonly commandResult: R
	readonly reactUserId: string
	readonly commandMessage: CommandMessageProperties<P>
	readonly channelId: string
	readonly messageId: string
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
	readonly reacts?: MessageReacts<P, R>
	handler(context: AppContext, opts: CommandMessageProperties<P>): Async<R>
}

export class Bot {

	private readonly client: Discord.Client
	private readonly rest: Discord.REST
	private readonly commandStorage: InteractionStorage
	private readonly allowedChannels: Set<string> | null

	getTextChannel(id: string): Discord.TextBasedChannel {
		const channel = this.client.channels.cache.get(id)
		if(!channel || !channel.isTextBased()){
			throw new Error("Discord channel " + id + " is not accessible for bot, or is not text-based channel.")
		}
		return channel
	}

	constructor(readonly context: AppContext, readonly token: string) {
		this.commandStorage = new InteractionStorage(context.config.reactionWaitingTimeSeconds || 86400)

		this.allowedChannels = !context.config.channelID
			? null
			: new Set(context.config.channelID)

		this.client = new Discord.Client({
			intents: [
				Discord.GatewayIntentBits.Guilds,
				Discord.GatewayIntentBits.GuildMessages,
				Discord.GatewayIntentBits.MessageContent,
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
			if(description){
				builder.setDescription(description)
			}
			if(def.params){
				for(const paramName in def.params){
					const param = def.params[paramName]!
					const optBuilder = <T extends OptBase>(opt: T) => {
						opt.setName(paramName)
						const description = param.description(this.context)
						if(description){
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

	private isChannelAllowed(channelId: string): boolean {
		return !this.allowedChannels || this.allowedChannels.has(channelId)
	}

	private listen(): void {
		this.client.on("interactionCreate", interaction => {
			if(!interaction.isChatInputCommand() || !this.isChannelAllowed(interaction.channelId)){
				return
			}

			this.withErrorReporting(interaction.channelId, interaction, async() => {
				await this.processInteraction(interaction)
			})
		})

		this.client.on("messageCreate", msg => {
			this.withErrorReporting(msg.channelId, null, async() => {
				if(!this.isChannelAllowed(msg.channelId)){
					return
				}

				await this.processMessage(msg)
			})
		})

		this.client.on("messageReactionAdd", async(reaction, user) => {
			this.withErrorReporting(reaction.message.channelId, null, async() => {
				await this.processReaction(reaction, user)
			})
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

		const reactHandler = command.reacts[reaction.emoji.name || ""]
		if(!reactHandler){
			return
		}

		const reactOpts: CommandReactHandlerOptions = {
			channelId: reaction.message.channelId,
			messageId: reaction.message.id,
			commandResult: command.reply,
			commandMessage: command.msg,
			reactUserId: user.id
		}
		await Promise.resolve(reactHandler(this.context, reactOpts))
	}

	private async processMessage(message: Discord.Message): Promise<void> {
		const msgStr = message.content
		if(!msgStr.startsWith("!")){
			return
		}
		const commandNameRaw = msgStr.split(" ")[0]!
		const commandName = commandNameRaw.substring(1)
		const commandDef = commands[commandName as CommandName]
		if(!commandDef){
			return // not our command anyway
		}

		const params = commandDef.params
		const opts: Record<string, string | number> = {}
		if(params){
			const paramNames = Object.keys(params)
			if(paramNames.length > 1){
				// right now we just don't need them. maybe later.
				throw new Error("Cannot process more than one param on this message")
			}
			const paramName = paramNames[0]
			if(paramName){
				const paramDef = params[paramName]!
				const valueStr = msgStr.substring(commandNameRaw.length).trim()
				let value: string | number
				switch(paramDef.type){
					case "string":
						value = valueStr
						break
					case "number":
						value = parseFloat(valueStr)
						if(Number.isNaN(value)){
							throw new BotError(this.context.formatter.errorParamNotNumber(paramName, valueStr, {userId: message.author.id}))
						}
						break
				}
				opts[paramName] = value
			}
		}

		const attachments = [] as MessageAttachment[]
		for(const attachment of message.attachments.values()){
			attachments.push({
				url: attachment.url,
				contentType: attachment.contentType
			})
		}

		await this.runCommand({
			channelId: message.channelId,
			command: commandName,
			options: opts,
			userId: message.author.id,
			attachments
		})
	}

	private async processInteraction(interaction: DefaultInteraction): Promise<void> {
		const opts: Record<string, string | number> = {}
		for(const item of interaction.options.data){
			if(typeof(item.value) === "string" || typeof(item.value) === "number"){
				opts[item.name] = item.value
			}
		}
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

		const reply = await Promise.resolve(def.handler(this.context, msg))
		const replyMessage = await this.replyOrSend(msg.channelId, {content: reply.reply}, interaction)

		if(def.reacts && !reply.isRefuse){
			this.addReactsToMessage(replyMessage, msg, reply, def.reacts)
		}
	}

	addReactsToMessage(replyMessage: Discord.Message, messageCommand: CommandMessageProperties, reply: CommandResult, reacts: MessageReacts): void {
		this.commandStorage.add(replyMessage.id, messageCommand, reply, reacts)
		for(const emote in reacts){
			replyMessage.react(emote)
		}
	}

	async mbSend(channelId: string, message: string | {content?: string, files?: AttachmentWithData[]} | undefined, interaction?: DefaultInteraction): Promise<Discord.Message | null> {
		const msg: {content?: string, files?: Discord.AttachmentBuilder[]} = {}
		if(message === undefined){
			return null
		}
		if(typeof(message) === "string"){
			if(!message){
				return null
			}
			msg.content = message
		} else {
			if(!message.content && (!message.files || message.files.length === 0)){
				return null
			}
			msg.content = message.content
			if(message.files){
				msg.files = message.files.map(({name, data}) => new Discord.AttachmentBuilder(
					data, {name}
				))
			}
		}
		return await this.replyOrSend(channelId, msg, interaction)
	}

	private async replyOrSend(channelId: string, message: {content?: string, files?: Discord.AttachmentBuilder[]}, interaction?: DefaultInteraction): Promise<Discord.Message> {
		if(interaction && !interaction.replied){
			return await interaction.reply({...message, fetchReply: true})
		} else {
			const channel = interaction?.channel || this.getTextChannel(channelId)
			return await channel.send(message)
		}
	}

	async withErrorReporting(channelId: string, interaction: DefaultInteraction | null, body: () => void | Promise<void>): Promise<void> {
		try {
			await body()
		} catch(e){
			let errMsg: string
			if(e instanceof BotError){
				errMsg = e.message
			} else {
				errMsg = "Oh noes! Something failed UwU! We awe sowwy. Go look into logs."
				console.error(errToString(e))
			}

			this.reportError(errMsg, channelId, interaction || undefined)
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

	private getMessage(channelID: string, messageID: string): Discord.Message | undefined {
		const channel = this.getTextChannel(channelID)
		return channel.messages.cache.get(messageID)
	}

	async deleteMessage(channelID: string, messageID: string): Promise<void> {
		const msg = this.getMessage(channelID, messageID)
		if(!msg){
			console.error(`Cannot delete message ${messageID} from ${channelID}: no message`)
			return
		}
		if(!msg.deletable){
			console.error(`Cannot delete message ${messageID} from ${channelID}: message is not deletable`)
			return
		}
		await msg.delete()
	}

	async downloadAttachments(channelID: string, messageID: string): Promise<AttachmentWithData[]> {
		const msg = this.getMessage(channelID, messageID)
		if(!msg){
			return []
		}

		const files = [] as AttachmentWithData[]
		let i = 0
		for(const attachment of msg.attachments.values()){
			++i
			const fileContent = await httpGet(attachment.url)
			const fileName = attachment.name
				? attachment.name
				: attachment.contentType
					? i + "." + attachment.contentType.replace(/^.*?\//, "")
					: "unknown_file"
			files.push({data: fileContent, name: fileName})
		}
		return files
	}

}