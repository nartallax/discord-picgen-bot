import {GenerationParamDescription} from "generation_input"

export interface Config {
	/** Client ID. Get it from here:
	 * https://discord.com/developers/applications/<your_bot_id>/oauth2/general */
	readonly clientID: string
	readonly guildID: string
	readonly params: GenerationParamDescription[]
	readonly commandTemplate: string
}