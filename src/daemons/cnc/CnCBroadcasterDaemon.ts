import {NS} from "@ns";
import {create, IpcBroadcastServer} from "/lib/ipc/broadcast/IpcBroadcastServer";
import {Bounds} from "/daemons/cnc/Bounds";
import * as enums from 'lib/enums'
import {IpcMessagingServer, simplex} from "/lib/ipc/messaging/IpcMessagingServer";
import {CnCEndpoints} from "/daemons/cnc/CnCEndpoints";
import {Logger} from "/lib/logging/Logger";

export const cncDaemonIdentifier = 'daemon-cnc'
export const cncDataFile = '/data/cnc.txt'

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const args = ns.flags([
		['max-hack-percentage', 0.3],
		['max-threads', 500]
	])
	const maxHackPercentage = args['max-hack-percentage'] as number
	const maxThreads = args['max-threads'] as number

	await new CnCBroadcasterDaemon(ns, maxHackPercentage, maxThreads).main()
}

export class CnCBroadcasterDaemon {
	maxHackPercentage: number
	maxThreads: number
	private readonly _ns: NS
	private readonly _logger: Logger
	private readonly _broadcastServer: IpcBroadcastServer<Bounds>
	private readonly _messagingServer: IpcMessagingServer<Bounds | string>

	constructor(ns: NS, maxHackPercentage: number, maxThreads: number) {
		this._ns = ns

		this._logger = new Logger(ns)

		this._broadcastServer = create<Bounds>(ns, enums.PortIndex.cncBroadcasting)
		this._messagingServer = simplex<Bounds | string>(ns, cncDaemonIdentifier, enums.PortIndex.cncMessaging)

		const json = ns.read(cncDataFile)
		if (json === '') {
			this.maxHackPercentage = maxHackPercentage
			this.maxThreads = maxThreads
		} else {
			const data = JSON.parse(json) as Bounds
			this.maxHackPercentage = data.maxHackPercentage
			this.maxThreads = data.maxThreads
		}
	}

	async main(): Promise<void> {
		await this._broadcastServer.broadcast({
			maxHackPercentage: this.maxHackPercentage,
			maxThreads: this.maxThreads
		})
		// noinspection InfiniteLoopJS
		while (true) {
			const handler = await this._messagingServer.listen()
			switch (handler.request.endpoint) {
				case CnCEndpoints.get: {
					this._logger.info()
						.withIdentifier(handler.request.messageId)
						.print('Getting bounds')
					await handler.respond({
						maxHackPercentage: this.maxHackPercentage,
						maxThreads: this.maxThreads,
					})
					break
				}
				case CnCEndpoints.set: {
					const data = handler.request.messageData as Bounds
					this._logger.info()
						.withIdentifier(handler.request.messageId)
						.withFormat('Setting bounds to %s')
						.print(JSON.stringify(data))
					this.maxHackPercentage = data.maxHackPercentage
					this.maxThreads = data.maxThreads

					this.write(data)

					await this._broadcastServer.broadcast(data)
					await handler.respond('OK')
					break
				}
			}
		}
	}

	write(bounds: Bounds): void {
		const json = JSON.stringify(bounds)
		this._ns.write(cncDataFile, json, 'w')
	}
}
