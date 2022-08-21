import * as Http from "http"
import * as Https from "https"

export function httpGet(urlStr: string): Promise<Buffer> {
	return new Promise((ok, bad) => {
		try {
			const url = new URL(urlStr)
			const lib = url.protocol.toLowerCase() === "https:" ? Https : Http
			const request = lib.request({
				host: url.host,
				port: url.port,
				path: url.pathname + (url.search || "")
			}, response => {
				const chunks = [] as Buffer[]
				response.on("error", e => bad(e))
				response.on("data", chunk => chunks.push(chunk))
				response.on("end", () => {
					const buffer = Buffer.concat(chunks)
					ok(buffer)
				})
			})
			request.on("error", e => bad(e))
			request.end()
		} catch(e){
			bad(e)
		}
	})
}