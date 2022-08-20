export interface LinkedListEl<V> {
	/** prev - ближе к хвосту очереди */
	prev: LinkedListEl<V> | null
	/** next - ближе к голове очереди */
	next: LinkedListEl<V> | null
	value: V
}

export interface ReadonlyLinkedList<V> extends Iterable<V>{
	readonly size: number
	showHead(): V | undefined
	showTail(): V | undefined
	forEachTailToHead(handler: (item: V) => void): void
	forEachHeadToTail(handler: (item: V) => void): void
	[Symbol.iterator](): Iterator<V>
}

/** Двусвязный список */
export class LinkedList<V> implements ReadonlyLinkedList<V> {

	size = 0

	/** наиболее недавно добавленные */
	protected tail: LinkedListEl<V> | null = null
	/** наиболее давно добавленные */
	protected head: LinkedListEl<V> | null = null

	addToTail(value: V): void {
		const newTail: LinkedListEl<V> = {prev: null, next: this.tail, value: value}

		if(this.tail){
			this.tail.prev = newTail
		}
		this.tail = newTail

		if(!this.head){
			this.head = newTail
		}

		this.size++
	}

	addToHead(value: V): void {
		const newHead: LinkedListEl<V> = {prev: this.head, next: null, value}
		if(this.head){
			this.head.next = newHead
		}
		this.head = newHead

		if(!this.tail){
			this.tail = newHead
		}
		this.size++
	}

	removeHead(): V | undefined {
		if(!this.head){
			return undefined
		}

		const res = this.head.value
		this.removeElement(this.head)
		return res
	}

	removeTail(): V | undefined {
		if(!this.tail){
			return undefined
		}

		const res = this.tail.value
		this.removeElement(this.tail)
		return res
	}

	/** Добавить переданную очередь в хвост этой
	 * Подразумевается, что переданная очередь больше не будет использоваться */
	addAllToTail(otherQueue: LinkedList<V>): void {
		if(!otherQueue.head){
			return
		}
		if(!this.head){
			this.head = otherQueue.head
			this.tail = otherQueue.tail
			this.size = otherQueue.size
			return
		}
		this.tail!.prev = otherQueue.head
		this.tail!.prev.next = this.tail
		this.tail = otherQueue.tail
		this.size += otherQueue.size
	}

	showHead(): V | undefined {
		return this.head ? this.head.value : undefined
	}

	showNextToHead(): V | undefined {
		let res = this.head
		if(res){
			res = res.prev
		}
		return res ? res.value : undefined
	}

	showTail(): V | undefined {
		return this.tail ? this.tail.value : undefined
	}

	/** Удалить первый элемент списка, соответствующий условию */
	removeFirst(condition: (value: V) => boolean): V | null {
		let current = this.tail
		while(current){
			if(!condition(current.value)){
				current = current.next
				continue
			}

			this.removeElement(current)
			return current.value
		}

		return null
	}

	/** Удалить все элементы очереди */
	clear() {
		this.size = 0
		this.head = this.tail = null
	}

	protected removeElement(el: LinkedListEl<V>) {
		if(el.prev){
			el.prev.next = el.next
		} else {
			this.tail = el.next
		}
		if(el.next){
			el.next.prev = el.prev
		} else {
			this.head = el.prev
		}
		this.size--
	}

	forEachTailToHead(handler: (item: V) => void): void {
		let curr = this.tail
		while(curr){
			handler(curr.value)
			curr = curr.next
		}
	}

	forEachHeadToTail(handler: (item: V) => void): void {
		let curr = this.head
		while(curr){
			handler(curr.value)
			curr = curr.prev
		}
	}

	[Symbol.iterator](): Iterator<V> {
		let current = this.tail

		return {
			next() {
				if(!current){
					return {done: true, value: undefined as unknown}
				} else {
					const v = current.value
					current = current.next
					return {done: false, value: v}
				}
			}
		}
	}

	protected* elementsHeadToTail(): IterableIterator<LinkedListEl<V>> {
		let current = this.tail

		while(current){
			const v = current
			current = current.next
			yield v
		}
	}

	filterInPlace(isGood: (value: V) => boolean): void {
		let curr = this.head
		this.head = this.tail = null
		this.size = 0
		while(curr){
			if(isGood(curr.value)){
				this.addToTail(curr.value)
			}
			curr = curr.prev
		}
	}

	filter(isGood: (value: V) => boolean): LinkedList<V> {
		const result = new LinkedList<V>()
		let curr = this.head
		while(curr){
			if(isGood(curr.value)){
				result.addToTail(curr.value)
			}
			curr = curr.prev
		}
		return result
	}

	mapToArray<R>(handler: (value: V) => R): R[] {
		const result = [] as R[]
		this.forEachHeadToTail(item => result.push(handler(item)))
		return result
	}

	// substitutes values in place
	mapInPlace(handler: (value: V) => V): void {
		let curr = this.head
		while(curr){
			curr.value = handler(curr.value)
			curr = curr.prev
		}
	}

}