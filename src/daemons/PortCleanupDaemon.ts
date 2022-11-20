import {NS} from "@ns";
import {Logger} from 'lib/logging/Logger'
import {Envelop, IpcPortClient} from "/lib/ipc/IpcPortClient";
import * as enums from 'lib/enums'

export const portCleanupIdentifier = 'port-cleanup-daemon'
const allActivePorts = Object.values(enums.PortCleanup).filter(value => Number.isInteger(value))

const timeout = 10000

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	await new PortCleanupDaemon(ns).main()
}

export class PortCleanupDaemon {
	private readonly _ns: NS

	private readonly _logger: Logger

	private readonly _clients: IpcPortClient<unknown>[] = []

	constructor(ns: NS) {
		this._ns = ns
		this._logger = new Logger(ns)
		allActivePorts.forEach(port => this._clients.push(new IpcPortClient<unknown>(ns, portCleanupIdentifier, +port)))
	}

	async main(): Promise<void> {
		// noinspection InfiniteLoopJS
		while (true) {
			const now = new Date().getTime()

			for (const client of this._clients) {
				const envelope = client.forcePeek()
				if (envelope === undefined) {
					continue
				}
				const sent = (envelope as Envelop<unknown>).sent
				if (now > sent + timeout) {
					this._logger.warn()
						.withFormat('Message in queue for longer than %s seconds %s')
						.print(timeout / 1000, JSON.stringify(envelope))
					client.pop()
				}
			}

			await this._ns.sleep(10000)
		}
	}
}
