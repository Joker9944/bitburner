import {NetscriptPort, NS} from '@ns'

// TODO implement a max amount of tried
export class IpcPortClient<T> {
	identifier: string
	private _ns: NS
	private _portHandleIn: NetscriptPort
	private _portHandleOut: NetscriptPort

	constructor(ns: NS, identifier: string, portIn: number, portOut?: number) {
		this._ns = ns
		this.identifier = identifier
		this._portHandleIn = ns.getPortHandle(portIn)
		if (portOut === undefined) {
			this._portHandleOut = ns.getPortHandle(portIn)
		} else {
			this._portHandleOut = ns.getPortHandle(portOut)
		}
	}

	async read(): Promise<Envelop<T>> {
		let readData
		do {
			const envelop = await this.peek()
			if (envelop.recipient === this.identifier) {
				readData = envelop
				this.pop()
			} else {
				await this._ns.sleep(200)
			}
		} while (readData === undefined)
		return readData
	}

	async write(recipient: string, data: T): Promise<void> {
		const envelop: Envelop<T> = {
			author: this.identifier,
			recipient: recipient,
			sent: new Date().getTime(),
			data: data,
		}
		const json = JSON.stringify(envelop)
		while (!this._portHandleOut.tryWrite(json)) {
			await this._ns.sleep(200)
		}
	}

	async peek(): Promise<Envelop<T>> {
		let portData
		do {
			const peekData = this._portHandleIn.peek()
			if ((peekData as string) === 'NULL PORT DATA') {
				await this._ns.sleep(200)
			} else {
				portData = peekData
			}
		} while (portData === undefined)
		return JSON.parse(portData as string) as Envelop<T>
	}

	forcePeek(): Envelop<T> | unknown {
		const peekData = this._portHandleIn.peek()
		if ((peekData as string) === 'NULL PORT DATA') {
			return undefined
		} else {
			return JSON.parse(peekData as string) as Envelop<T>
		}
	}

	pop(): void {
		this._portHandleIn.read()
	}
}

export type Envelop<T> = {
	author: string
	recipient: string
	sent: number
	data: T
}
