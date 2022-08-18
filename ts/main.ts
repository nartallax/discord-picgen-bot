import {Bot} from "bot"
import {promises as Fs} from "fs"
import {Config} from "types"

export async function main(): Promise<void> {
	try {
		const token = (await Fs.readFile("./token.txt", "utf-8")).replace(/[\s\n\r\t]/g, "")
		const config: Config = JSON.parse(await Fs.readFile("./config.json", "utf-8"))

		const bot = new Bot(config, token)

		await bot.start()
		console.error("Bot started and ready to serve!")
	} catch(e){
		console.error("Failed to start!")
		console.error(e instanceof Error ? e.stack || e.message : e + "")
		process.exit(1)
	}
}