import {promises as Fs} from "fs"
import {dirExists} from "utils"
import * as JIMP from "jimp"
import * as Path from "path"

let imageIdCounter = 0

const allowedFormats: ReadonlySet<string> = new Set(
	["jpg", "jpeg", "png", "bmp", "tiff", "gif"]
)

export class PictureManager {

	constructor(private readonly pictureDir: string, private readonly convertToFormat?: string) {
		if(convertToFormat){
			this.checkIsAllowedExt(convertToFormat)
		}
	}

	private checkIsAllowedExt(format: string): void {
		if(!allowedFormats.has(format.toLowerCase())){
			throw new Error("Images of format " + format + " can't be processed by the bot.")
		}
	}

	async init(): Promise<void> {
		if(await dirExists(this.pictureDir)){
			await Fs.rm(this.pictureDir, {recursive: true})
		}
		await Fs.mkdir(this.pictureDir)
	}

	async storeImage(mime: string | null, data: Buffer): Promise<string> {
		if(!mime || !mime.startsWith("image/")){
			throw new Error("Mime-type of the image is not image: " + mime)
		}

		const id = ++imageIdCounter
		const pathWithoutExt = Path.resolve(this.pictureDir, id + "")
		let fullPath: string

		const imageExt = mime.substring("image/".length)
		if(this.convertToFormat){
			this.checkIsAllowedExt(imageExt)
			const img = await JIMP.create(data)
			fullPath = pathWithoutExt + "." + this.convertToFormat
			await img.writeAsync(fullPath)
		} else {
			fullPath = pathWithoutExt + "." + imageExt
			await Fs.writeFile(pathWithoutExt + "." + imageExt, data)
		}

		return fullPath
	}

	async deleteImage(image: string): Promise<void> {
		await Fs.rm(image)
	}

}