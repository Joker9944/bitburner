import {NS} from "@ns";
import {Logger} from "/lib/logging/Logger";
import {Toaster} from "/lib/logging/Toaster";
import {FlufferCalculator} from "/lib/FlufferCalculator";
import {createRamClient, IpcRamClient} from "/daemons/ram/IpcRamClient";
import {calculateTotalTickets, Reservation} from "/daemons/ram/RamMessageType";
import {execReservations} from "/daemons/ram/execReservations";
import * as enums from 'lib/enums'

const identifierPrefix = 'exp-grinder-'
const refreshPeriod = 60000

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL');

	const args = ns.flags([
		['max-threads', 10000]
	])
	const maxThreads = args['max-threads'] as number
	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'foodnstuff' : (args['_'] as string[])[0]

	await new ExpGrinder(ns, maxThreads, targetServerHostname).main()
}

class ExpGrinder {
	readonly maxThreads: number
	private readonly _ns: NS
	private readonly _logger: Logger
	private readonly _toaster: Toaster
	private readonly _calculator: FlufferCalculator
	private readonly _ramClient: IpcRamClient

	private _maxThreads = 0
	private _reservations: Reservation[] = []
	private _reservedThreads = 0
	private _lastRefresh = (-refreshPeriod) - 1
	private _batch = 1

	constructor(ns: NS, maxThreads: number, targetServerHostname: string) {
		this._ns = ns

		this._logger = new Logger(ns)
		this._toaster = new Toaster(ns)

		this.maxThreads = maxThreads

		this._calculator = new FlufferCalculator(ns, targetServerHostname)
		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
	}

	async main(): Promise<void> {
		// noinspection InfiniteLoopJS
		while (true) {
			const now = new Date().getTime()
			const batchDuration = this._calculator.determineWWait()
			if (now > this._lastRefresh + refreshPeriod) {
				this._maxThreads = await this.determineMaxThreads()

				const reservationTime = batchDuration > refreshPeriod ? batchDuration : refreshPeriod + batchDuration // TODO improve less than calculation
				this._reservations = (await this._ramClient.reserveThreads({
					name: 'weaken',
					tickets: this._maxThreads,
					allocationSize: enums.ScriptCost.weaken,
					duration: reservationTime,
					affinity: {
						hostnames: ['home'],
						anti: false,
						hard: this._calculator.ownsAdditionalCores()
					}
				})).weaken
				this._reservedThreads = calculateTotalTickets(this._reservations)
			}

			const startedThreads = execReservations(this._ns, this._reservations, enums.LaunchpadScripts.weaken,
				this._calculator.targetNode.server.hostname);

			if (startedThreads !== this._reservedThreads) {
				this._logger.error()
					.withIdentifier(this._batch)
					.withFormat('Started threads do not match reserved threads %s != %s')
					.print(startedThreads, this._reservedThreads)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}

			this._logger.info()
				.withIdentifier(this._batch)
				.withFormat('G %s / R %s')
				.print(startedThreads, this._reservedThreads)
			this._logger.info()
				.withIdentifier(this._batch)
				.withFormat('Duration %s')
				.print(this._ns.tFormat(batchDuration, true))

			await this._ns.sleep(batchDuration)

			this._calculator.refresh()

			this._batch++
		}
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this._ramClient.lookupTotalThreads()
		return Math.min(maxAvailableThreads, this.maxThreads)
	}
}
