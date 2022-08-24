import {AppContext} from "context"
import {CommandPropsShort, Formatter} from "formatters/formatter"
import {GenerationCommandDescription, GenTask} from "types"

export class GenerationFormatter extends Formatter {

	constructor(context: AppContext, readonly genCmd: GenerationCommandDescription) {
		super(context)
	}

	outputPictureNotFound(task: GenTask, fileName: string): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.outputPictureFormat(this.selectPrivatePublic(task, this.t.generation?.outputPictureNotFound), task, fileName)
	}

	failedToReadOutputPicture(task: GenTask, fileName: string): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.outputPictureFormat(this.selectPrivatePublic(task, this.t.generation?.outputPictureNotFound), task, fileName)
	}

	outputPicture(task: GenTask, fileName: string): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.outputPictureFormat(this.selectPrivatePublic(task, this.t.generation?.outputPicture), task, fileName)
	}

	private outputPictureFormat(template: string | string[] | undefined, task: GenTask, fileName: string): string | undefined {
		return this.format(template, {
			...this.makeTaskParams(task),
			GENERATED_PICTURE_PATH: fileName
		})
	}

	generationCompleted(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.generation?.generationCompleted), this.makeTaskParams(task))
	}

	newTaskCreated(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.generation?.newTaskCreated), this.makeTaskParams(task))
	}

	promptWordsDroppedOnTaskCreation(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.generation?.promptWordsDroppedOnTaskCreation), this.makeTaskParams(task))
	}

	noParams(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.generation?.noParams, this.makeCommandParams(cmd))
	}

	description(): string {
		return this.format(this.genCmd.text?.description, {}) || ""
	}

	paramDescription(): string {
		return this.format(this.genCmd.text?.paramDescription, {}) || ""
	}

}