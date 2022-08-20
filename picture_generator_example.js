// this is example program that generates pictures!
// it exists to show you, the user of the bot, how to write your picture generating program
// it can be launched with following command:
// node picture_generator_example.js '{"param":"value"}'

// just requesting some libraries from NodeJS
const Fs = require("fs")

// entrypoint of the picture generator
// this function will be called when picture generator is launched
async function main() {

	// some generation arguments are passed as command-line parameter
	// what they will look like exactly is defined by bot config
	const parameters = JSON.parse(process.argv[2] || "{}")
	// arbitrary text logs go into stderr
	// stderr logs can be seen in bot's own stderr
	process.stderr.write("Got parameters! " + JSON.stringify(parameters) + "\n")

	const willGenerateFilesCount = 2
	
	// let's tell the bot how many pictures to expect
	// if you don't, or tell incorrect number of pictures - it won't break anything
	// it just allows for more beautiful inputs
	process.stdout.write(JSON.stringify({willGenerateCount: willGenerateFilesCount}) + "\n")

	// we will generate some pictures
	for(let i = 0; i < willGenerateFilesCount; i++){
		// sleep for 5 seconds
		// implying some generation is going on, it's a slow process, give it some time
		await new Promise(ok => setTimeout(ok, 5000))

		// now let's generate a file!
		// it will actually be the same file every time
		// that we put in the same location every time
		const filePath = "./resulting_picture_example.png"
		// so, we put some data into file
		await Fs.promises.writeFile(filePath, Buffer.from(myPictureBase64, "base64"))
		// and then emit JSON into stdout, saying "hey, we just generated a file!"
		// note newline at the end of the string
		// bot expects that each new JSON will be on the next line
		process.stdout.write(JSON.stringify({generatedPicture: filePath}) + "\n")
	}

	// everything is fine! let's exit normally, with exit code 0
	process.exit(0)
}

// don't mind this, just a content of some picture
// it is used in main() function
const myPictureBase64 = "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";

// invocation of the entrypoint function
// because it's not gonna call itself, y'know
main()