import {NS} from '@ns'
import {IpcPortClient} from "/lib/ipc/IpcPortClient";
import {Message} from "/lib/ipc/messaging/Message";
import {Request} from "/lib/ipc/messaging/Request";

export function simplex<T>(ns: NS, identifier: string, port: number): IpcMessagingServer<T> {
	return new IpcMessagingServer(new IpcPortClient<Message<T>>(ns, identifier, port))
}

export class IpcMessagingServer<T> {
	private readonly _portClient: IpcPortClient<Message<T>>

	constructor(portClient: IpcPortClient<Message<T>>) {
		this._portClient = portClient
	}

	async listen(): Promise<RequestHandler<T>> {
		const envelope = await this._portClient.read()
		return new RequestHandler(this._portClient, {
			endpoint: envelope.data.endpoint,
			messageId: envelope.data.messageId,
			requester: envelope.author,
			messageData: envelope.data.messageData
		})
	}
}

export class RequestHandler<T> {
	readonly request: Request<T>
	private readonly _portClient: IpcPortClient<Message<T>>

	constructor(portClient: IpcPortClient<Message<T>>, request: Request<T>) {
		this._portClient = portClient
		this.request = request
	}

	async respond(data: T): Promise<void> {
		const message: Message<T> = {
			endpoint: this.request.endpoint,
			messageId: this.request.messageId,
			messageData: data
		}

		await this._portClient.write(this.request.requester, message)
	}
}
