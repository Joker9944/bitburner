import {NS} from "@ns";
import {Envelop, IpcPortClient} from "/lib/ipc/IpcPortClient";
import {Message} from "/lib/ipc/messaging/Message";
import {Response} from "/lib/ipc/messaging/Response";

export function simplex<T>(ns: NS, host: string, identifier: string, port: number): IpcMessagingClient<T> {
	return new IpcMessagingClient(host, new IpcPortClient<Message<T>>(ns, identifier, port))
}

export function duplex<T>(ns: NS, host: string, identifier: string, portIn: number, portOut: number): IpcMessagingClient<T> {
	return new IpcMessagingClient(host, new IpcPortClient<Message<T>>(ns, identifier, portIn, portOut))
}

export class IpcMessagingClient<T> {
	private readonly _host: string
	private readonly _portClient: IpcPortClient<Message<T>>

	private _index = 0

	constructor(host: string, portClient: IpcPortClient<Message<T>>) {
		this._host = host
		this._portClient = portClient
	}

	async get(endpoint: unknown, data?: T): Promise<Response<T>> {
		const message: Message<T> = {
			endpoint: endpoint,
			messageId: this._portClient.identifier + '-' + this._index++
		}

		if (data !== undefined) {
			message.messageData = data
		}

		await this._portClient.write(this._host, message)
		return await this._listen()
	}

	async post(endpoint: unknown, data: T): Promise<Response<T>> {
		const message: Message<T> = {
			endpoint: endpoint,
			messageId: this._portClient.identifier + '-' + this._index++,
			messageData: data
		}

		await this._portClient.write(this._host, message)
		return await this._listen()
	}

	private async _listen(): Promise<Response<T>> {
		const envelope = await this._portClient.read() as Envelop<Message<T>>
		return {
			endpoint: envelope.data.endpoint,
			messageId: envelope.data.messageId,
			host: envelope.author,
			messageData: envelope.data.messageData
		}
	}
}
