import {NS} from "@ns";
import {IpcPortClient} from "/lib/ipc/IpcPortClient";

export function create<T>(ns: NS, port: number): IpcBroadcastServer<T> {
	return new IpcBroadcastServer(new IpcPortClient<T>(ns, 'ALL', port))
}

export class IpcBroadcastServer<T> {
	private readonly _portClient: IpcPortClient<T>

	constructor(portClient: IpcPortClient<T>) {
		this._portClient = portClient
	}

	async broadcast(data: T): Promise<void> {
		this._portClient.pop()
		await this._portClient.write('ALL', data)
	}
}
