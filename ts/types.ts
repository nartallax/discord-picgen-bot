import * as ChildProcess from "child_process"
import * as Stream from "stream"

interface PrivatePublicTemplate {
	private: string
	public: string
}

export type CommandOptionsObject<P extends string = string> = {readonly [key in P]: number | string}

export interface CommandMessageProperties<P extends string = string> {
	readonly channelId: string
	readonly userId: string
	readonly command: string
	readonly options: CommandOptionsObject<P>
	readonly attachments?: readonly MessageAttachment[]
	readonly creationTime?: number
	readonly roleName: string | null
}

export interface MessageAttachment {
	readonly url: string
	readonly contentType: string | null
}

export interface HelpCommandDescription {
	readonly type: "help"
	readonly for: string
	readonly text?: DeepTexts<{
		description: string
		header: string
	}>
}

export interface RepeatCommandDescription {
	readonly type: "repeat_generation"
	readonly anyOfLatest: readonly string[]
	readonly text: DeepTexts<{
		description: string
		noPreviousFound: string
	}>
}

export interface GenerationCommandDescription {
	readonly type: "generation"
	readonly commandTemplate: string
	readonly params: readonly GenParamDescription[]
	readonly prompt?: {
		readonly position: "before_params" | "after_params"
		readonly maxWordCount?: number
	}
	readonly convertInputPicturesTo?: string
	readonly text?: DeepTexts<{
		description: string
		paramDescription: string
	}>
}

export type CommandDescription = GenerationCommandDescription | HelpCommandDescription | RepeatCommandDescription

export interface Config {
	/** Client ID. Get it from here:
	 * https://discord.com/developers/applications/<your_bot_id>/oauth2/general */
	readonly clientID: string
	readonly guildID: string
	readonly channelID?: readonly string[]
	readonly savedPropmtsChannelID?: string
	readonly starredPromptsChannelID?: string
	readonly promptCutoffLimitInDisplay?: number
	readonly deleteFiledAfterUpload?: boolean
	readonly reactionWaitingTimeSeconds?: number
	readonly tempPicturesDirectory: string
	readonly maxTasksShownInStatus?: number
	readonly namedRoles?: readonly [string, readonly string[]][]
	readonly permissions?: {
		readonly [commandOrEmote in string]?: readonly string[]
	}
	readonly commands: {
		readonly [k: string]: CommandDescription
	}
	readonly repeatedTasks?: readonly ({
		readonly timeMask: readonly string[]
	} & CommandMessageProperties)[]
	readonly text?: DeepTexts<{
		lenny: string
		savedPrompt: string
		starredPrompt: string
		ping: {
			description: string
			reply: string
		}
		pause: {
			description: string
			reply: string
		}
		unpause: {
			description: string
			reply: string
		}
		errors: {
			cannotResolveGuild: string
			cannotResolveMember: string
			actionNotAllowed: string
			paramNotNumber: string
			badConfigLaunchCommandTooComplex: string
			badConfigNoCommandParts: string
			unknownParam: string
			attachmentNotPicture: string
			duplicateParamPassed: string
			noValueAfterParam: string
			paramNotInteger: string
			paramNotInAllowedList: string
			requiredParamNotPassed: string
			pictureTooLarge: string
		}
		generation: {
			outputPictureNotFound: PrivatePublicTemplate
			cannotReadOutputPicture: PrivatePublicTemplate
			outputPicture: PrivatePublicTemplate
			generationCompleted: PrivatePublicTemplate
			noParams: string
			newTaskCreated: PrivatePublicTemplate
			newTaskCreatedPaused: PrivatePublicTemplate
			promptWordsDroppedOnTaskCreation: PrivatePublicTemplate
		}
		status: {
			description: string
			runningTask: PrivatePublicTemplate
			queuedTask: PrivatePublicTemplate
			runningTasksPrefix: string
			queuedTasksPrefix: string
			noTasks: string
			tasksUnshown: string
		}
		drop: {
			description: string
			taskIdDescription: string
			noTaskId: string
			killedRunningTask: PrivatePublicTemplate
			dequeuedTask: PrivatePublicTemplate
			taskNotFound: string
		}
		purge: {
			description: string
			completed: string
		}
		clear: {
			description: string
			completed: string
		}
		kill: {
			description: string
			success: PrivatePublicTemplate
			taskNotFound: string
		}
	}>
}

export interface GenTaskInput {
	prompt: string
	readonly roleName: string | null
	readonly rawInputString: string
	readonly rawParamString: string
	readonly userId: string
	readonly paramsPassedByHuman: readonly string[]
	readonly originalKeyValuePairs: readonly [key: string, value: GenParamValue][]
	readonly params: GenParamValuesObject
	readonly id: number
	readonly channelId: string
	readonly droppedPromptWordsCount: number
	readonly isPrivate: boolean
	readonly isSilent: boolean
	readonly inputImages: readonly string[]
	readonly command: CommandMessageProperties
	readonly commandDescription: GenerationCommandDescription
}

export interface GenTask extends GenTaskInput {
	totalExpectedPictures?: number
	generatedPictures?: number
	startTime?: number
	exitCode?: number
	process?: ChildProcess.ChildProcessByStdio<null, Stream.Readable, null>
}

export function stripNonSerializableDataFromTask(task: GenTask): GenTask {
	return {
		...task,
		process: undefined
	}
}

export type GenParamValue = GenerationParamDescriptionValueType<GenParamDescription>
export type GenParamValuesObject = Record<string, GenParamValue>

export type GenParamDescription = GenerationStringParamDescription | GenerationNumberParamDescription | GenerationBoolParamDescription | GenerationEnumParamDescription

interface GenerationParamDescriptionBase<T> {
	readonly key: string | readonly string[]
	readonly keyHidden?: string | readonly string[]
	readonly jsonName: string
	readonly description?: string
	readonly default?: T
	readonly humanName?: string
}

export type GenerationParamDescriptionValueType<T> = T extends GenerationParamDescriptionBase<infer V> ? V : null

interface GenerationStringParamDescription extends GenerationParamDescriptionBase<string> {
	readonly type: "string"
}

interface GenerationEnumParamDescription extends GenerationParamDescriptionBase<string> {
	readonly type: "enum"
	readonly allowedValues: string[]
}

interface GenerationNumberParamDescription extends GenerationParamDescriptionBase<number> {
	readonly type: "int" | "float"
}

interface GenerationBoolParamDescription extends GenerationParamDescriptionBase<boolean> {
	readonly type: "bool"
	readonly role?: "private" | "silent"
}

type DeepTexts<T> = T extends string ? T | T[] : {
	readonly [k in keyof T]?: DeepTexts<T[k]>
}