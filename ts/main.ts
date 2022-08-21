import {createAppContext} from "context"
import {promises as Fs} from "fs"
import {Config} from "types"

export async function main(): Promise<void> {
	try {
		const token = (await Fs.readFile("./token.txt", "utf-8")).replace(/[\s\n\r\t]/g, "")
		const config: Config = JSON.parse(await Fs.readFile("./config.json", "utf-8"))
		const context = createAppContext(config, token)
		await context.pictureManager.init()
		await context.bot.start()
		console.error("Bot started and ready to serve!")
	} catch(e){
		console.error("Failed to start!")
		console.error(e instanceof Error ? e.stack || e.message : e + "")
		process.exit(1)
	}
}