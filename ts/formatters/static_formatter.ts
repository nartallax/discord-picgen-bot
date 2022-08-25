import {CommandPropsShort, Formatter} from "formatters/formatter"
import {GenTask} from "types"

export class StaticFormatter extends Formatter {

	statusRunningTask(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.status?.runningTask), this.makeTaskParams(task))
	}

	statusQueuedTask(task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.status?.queuedTask), this.makeTaskParams(task))
	}

	statusRunningTaskPrefix(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.status?.runningTasksPrefix, this.makeCommandParams(cmd))
	}

	statusQueuedTaskPrefix(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.status?.queuedTasksPrefix, this.makeCommandParams(cmd))
	}

	statusNoTasks(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.status?.noTasks, this.makeCommandParams(cmd))
	}

	dropNoTaskId(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.drop?.noTaskId, this.makeCommandParams(cmd))
	}

	dropKilledRunningTask(cmd: CommandPropsShort, task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.drop?.killedRunningTask), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	dropDequeuedTask(cmd: CommandPropsShort, task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.drop?.dequeuedTask), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	dropTaskNotFound(cmd: CommandPropsShort, taskId: number): string | undefined {
		return this.format(this.t.drop?.taskNotFound, {
			...this.makeCommandParams(cmd),
			TASK_ID: taskId + ""
		})
	}

	purgeCompleted(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.purge?.completed, this.makeCommandParams(cmd))
	}

	clearCompleted(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.clear?.completed, this.makeCommandParams(cmd))
	}

	pingReply(cmd: CommandPropsShort, timeDiffSeconds: number): string {
		return this.format(this.t.ping?.reply, {
			...this.makeCommandParams(cmd),
			TIME_DIFF: this.formatTimeSpan(timeDiffSeconds)
		}) || "pong!"
	}

	killSuccess(cmd: CommandPropsShort, task: GenTask): string | undefined {
		if(task.isSilent){
			return undefined
		}
		return this.format(this.selectPrivatePublic(task, this.t.kill?.success), {
			...this.makeCommandParams(cmd),
			...this.makeTaskParams(task)
		})
	}

	killTaskNotFound(cmd: CommandPropsShort): string | undefined {
		return this.format(this.t.kill?.taskNotFound, this.makeCommandParams(cmd))
	}

	dropDescription(): string | undefined {
		return this.format(this.t.drop?.description, {})
	}

	killDescription(): string | undefined {
		return this.format(this.t.kill?.description, {})
	}

	pingDescription(): string | undefined {
		return this.format(this.t.ping?.description, {})
	}

	purgeDescription(): string | undefined {
		return this.format(this.t.purge?.description, {})
	}

	clearDescription(): string | undefined {
		return this.format(this.t.clear?.description, {})
	}

	statusDescription(): string | undefined {
		return this.format(this.t.status?.description, {})
	}

	dropTaskIdDescription(): string | undefined {
		return this.format(this.t.drop?.taskIdDescription, {})
	}

	lenny(): string {
		return this.format(dflt(this.t.lenny, "( ͡° ͜ʖ ͡°)"), {})
	}

	errorParamNotNumber(paramName: string, paramValue: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.paramNotNumber, "Was expecting number as value of parameter $PARAM_NAME, got $PARAM_VALUE instead"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramName,
				PARAM_VALUE: paramValue
			}
		)
	}

	errorBadConfigLaunchCommandTooComplex(partJson: string, task: GenTask): string {
		return this.format(
			dflt(this.t.errors?.badConfigLaunchCommandTooComplex, "Bad configuration: weird generation command template. Some part of it parsed as $PART_JSON, and I don't know how to launch that."),
			{
				...this.makeTaskParams(task),
				PART_JSON: partJson
			}
		)
	}

	errorBadConfigNoCommandParts(task: GenTask): string {
		return this.format(
			dflt(this.t.errors?.badConfigNoCommandParts, "Bad configuration: weird generation command template. Expected to have at least one command part."),
			this.makeTaskParams(task)
		)
	}

	errorAttachmentNotPicture(command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.attachmentNotPicture, "One of the attachments is not picture; can't process."),
			this.makeCommandParams(command)
		)
	}

	errorDuplicateParamPassed(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.duplicateParamPassed, "One of parameters is defined twice, last time with key $PARAM_KEY"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}

	errorNoValueAfterParam(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.noValueAfterParam, "Expected a value after key $PARAM_KEY"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}
	errorParamNotInteger(paramKey: string, paramValue: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.paramNotInteger, "Expected integer number value after key $PARAM_KEY, but this value has fractional part: $PARAM_VALUE"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey,
				PARAM_VALUE: paramValue
			}
		)
	}

	errorParamNotInAllowedList(paramKey: string, paramValue: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.paramNotInAllowedList, "Value $PARAM_VALUE is not one of allowed values of parameter $PARAM_KEY."),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey,
				PARAM_VALUE: paramValue
			}
		)
	}

	errorRequiredParamNotPassed(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.requiredParamNotPassed, "No value is provided for parameter $PARAM_KEY, and it has no default. Cannot continue without this value."),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}

	errorUnknownParam(paramKey: string, command: CommandPropsShort): string {
		return this.format(
			dflt(this.t.errors?.unknownParam, "No param is defined for key $PARAM_KEY"),
			{
				...this.makeCommandParams(command),
				PARAM_KEY: paramKey
			}
		)
	}

	errorPictureTooLarge(size: number, task: GenTask): string {
		return this.format(
			dflt(this.t.errors?.pictureTooLarge, "Cannot upload picture $PICTURES_GENERATED / $PICTURES_EXPECTED: it is too large ($IMAGE_SIZE)"),
			{
				...this.makeTaskParams(task),
				IMAGE_SIZE: this.formatFileSize(size)
			}
		)
	}

	errorCannotResolveGuild(guildId: string): string {
		return this.format(
			dflt(this.t.errors?.cannotResolveGuild, "Cannot get guild $GUILD_ID!"),
			{
				GUILD_ID: guildId
			}
		)
	}

	errorCannotResolveMember(userId: string): string {
		return this.format(
			dflt(this.t.errors?.cannotResolveMember, "Cannot get member $USER_ID!"),
			{
				USER_ID: userId
			}
		)
	}

	errorActionNotAllowed(action: string, userId: string): string {
		return this.format(
			dflt(this.t.errors?.actionNotAllowed, "Hey $USER, you cannot do $ACTION!"),
			{
				USER: this.formatUserMention(userId),
				ACTION: action
			}
		)
	}

	savedPrompt(task: GenTask): string | undefined {
		return this.format(this.t.savedPrompt, this.makeTaskParams(task))
	}

	starredPrompt(task: GenTask): string | undefined {
		return this.format(this.t.starredPrompt, this.makeTaskParams(task))
	}

}

function dflt(x: string | string[] | undefined, deflt: string): string | string[] {
	if(!x){
		return deflt
	}
	if(Array.isArray(x) && x.length < 1){
		return deflt
	}
	return x
}