import {createAppContext} from "context"
import {promises as Fs} from "fs"
import {Config} from "types"
import {errToString} from "utils"

export async function main(): Promise<void> {

	process.on("uncaughtException", err => {
		console.error("Uncaught exception!" + err.stack)
	})

	process.on("unhandledRejection", err => {
		console.error("Uncaught exception! " + errToString(err))
	})


	try {
		const token = (await Fs.readFile("./token.txt", "utf-8")).replace(/[\s\n\r\t]/g, "")
		const config: Config = JSON.parse(await Fs.readFile("./config.json", "utf-8"))
		const context = createAppContext(config, token)
		await context.pictureManager.init()
		context.scheduler.start()
		await context.bot.start()
		console.error("Bot started and ready to serve!")
	} catch(e){
		console.error("Failed to start!")
		console.error(e instanceof Error ? e.stack || e.message : e + "")
		process.exit(1)
	}
}