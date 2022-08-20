import {LinkedList, LinkedListEl} from "linked_list"

export class MapQueue<K, V> extends LinkedList<{key: K, value: V}> {
	protected map = new Map<K, LinkedListEl<{key: K, value: V}>>()

	enqueue(key: K, value: V): void {
		if(!this.map.has(key)){
			super.addToTail({key, value})
			this.map.set(key, this.tail!)
		}
	}

	has(key: K): boolean {
		return this.map.has(key)
	}

	get(key: K): V | undefined {
		return this.map.get(key)?.value?.value
	}

	delete(key: K): boolean {
		const el = this.map.get(key)
		if(!el){
			return false
		}
		this.removeElement(el)
		return true
	}

	deleteWhile(shouldDelete: (key: K, value: V) => boolean): number {
		let result = 0
		for(const el of this.elementsHeadToTail()){
			if(!shouldDelete(el.value.key, el.value.value)){
				break
			}
			result++
			this.removeElement(el)
		}
		return result
	}

	protected removeElement(el: LinkedListEl<{key: K, value: V}>): void {
		super.removeElement(el)
		this.map.delete(el.value.key)
	}

	clear(): void {
		super.clear()
		this.map.clear()
	}

}