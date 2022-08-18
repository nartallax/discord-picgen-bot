export function isEnoent(x: unknown): x is Error & {code: "ENOENT"} {
	return x instanceof Error && (x as (Error & {code: "ENOENT"})).code === "ENOENT"
}

export function* grouped<T>(values: T[], groupSize: number): IterableIterator<T[]> {
	let group = [] as T[]
	for(let i = 0; i < values.length; i++){
		group.push(values[i]!)
		if(group.length >= groupSize){
			yield group
			group = []
		}
	}
	if(group.length > 0){
		yield group
	}
}

export function errToString(err: unknown): string {
	return err instanceof Error ? err.stack || err.message : err + ""
}