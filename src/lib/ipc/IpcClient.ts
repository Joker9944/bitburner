import { NetscriptPort, NS, PortData } from '@ns'

export class IpcClient<T> {
	private _ns: NS
	identifier: string
	private _portHandle: NetscriptPort

	constructor(ns: NS, identifier: string, port: number) {
		this._ns = ns
		this.identifier = identifier
		this._portHandle = ns.getPortHandle(port)
	}

	async receive(): Promise<Envelop<T>> {
		let response
		while (response === undefined) {
			const portData = await this._peek()
			const envelop = JSON.parse(portData as string) as Envelop<T>
			if (envelop.recipient === this.identifier) {
				response = envelop
				this._portHandle.read()
			} else {
				await this._ns.sleep(200)
			}
		}
		return response
	}

	async send(recipient: string, payload: T): Promise<void> {
		const data = new Envelop<T>(this.identifier, recipient, payload)
		const json = JSON.stringify(data)
		let success = false
		while (!success) {
			success = this._portHandle.tryWrite(json)
			if (!success) {
				await this._ns.sleep(200)
			}
		}
	}

	clear(): void {
		this._portHandle.clear()
	}

	private async _peek(): Promise<PortData> {
		let portData
		while (portData === undefined) {
			const peek = this._portHandle.peek()
			if ((peek as string) === 'NULL PORT DATA') {
				await this._ns.sleep(200)
			} else {
				portData = peek
			}
		}
		return portData
	}
}

export class Envelop<T> {
	author: string
	recipient: string
	payload: T

	constructor(author: string, recipient: string, payload: T) {
		this.author = author
		this.recipient = recipient
		this.payload = payload
	}
}
