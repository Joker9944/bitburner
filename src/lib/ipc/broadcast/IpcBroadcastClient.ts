import {NS} from "@ns";
import {IpcPortClient} from "/lib/ipc/IpcPortClient";

export function createBroadcastClient<T>(ns: NS, port: number): IpcBroadcastClient<T> {
	return new IpcBroadcastClient(new IpcPortClient<T>(ns, 'ALL', port))
}

export class IpcBroadcastClient<T> {
	private readonly _portClient: IpcPortClient<T>

	constructor(portClient: IpcPortClient<T>) {
		this._portClient = portClient
	}

	async get(): Promise<T> {
		const envelope = await this._portClient.peek()
		return envelope.data
	}
}
