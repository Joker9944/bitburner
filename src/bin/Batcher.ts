import {NS} from '@ns'
import {IdentifierLogger, LogType} from '/lib/logging/Logger'
import {Toaster} from '/lib/logging/Toaster'
import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import {createRamClient, IpcRamClient} from '/daemons/ram/IpcRamClient'
import {calculateTotalTickets, ReservationsByKey} from "/daemons/ram/RamMessageType"
import {execReservations} from "/daemons/ram/execReservations"
import {createBroadcastClient, IpcBroadcastClient} from "/lib/ipc/broadcast/IpcBroadcastClient"
import {Bounds} from "/daemons/cnc/Bounds"
import {runningHackingScripts} from "/lib/runningHackingScripts"
import * as enums from '/lib/enums'
import {getNetNode} from "/lib/NetNode";
import {calculateTotalThreads} from "/lib/findBatcherThreadCounts";

const identifierPrefix = 'batcher-'
const refreshPeriod = 60000

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const args = ns.flags([
		['max-hack-percentage', 0.3],
		['hack-percentage-suggestion', 0.2],
		['grow-thread-suggestion', 200],
	])
	const maxHackPercentage = args['max-hack-percentage'] as number
	const hackPercentageSuggestion = args['hack-percentage-suggestion'] as number
	const growThreadsSuggestion = args['grow-thread-suggestion'] as number
	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]

	await new Batcher(ns, targetServerHostname, maxHackPercentage, hackPercentageSuggestion, growThreadsSuggestion).main()
}

class Batcher {
	private readonly _ns: NS

	private readonly _logger: IdentifierLogger
	private readonly _toaster: Toaster

	private readonly _calculator: HGWFormulasCalculator
	private readonly _ramClient: IpcRamClient
	private readonly _broadcastClient: IpcBroadcastClient<Bounds>

	private _maxThreads = 0
	private _reservations: ReservationsByKey = {}
	private _reservedThreadsTotal = 0
	private _hackPercentage = 0
	private _lastRefresh = (-refreshPeriod) - 1
	private _batch = 0

	constructor(ns: NS, targetServerHostname: string, maxHackPercentage: number,
	            hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this._logger = new IdentifierLogger(ns)
		this._toaster = new Toaster(ns)

		this._calculator = new HGWFormulasCalculator(ns, getNetNode(ns, targetServerHostname),
			maxHackPercentage, hackPercentageSuggestion, growThreadsSuggestion)

		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
		this._broadcastClient = createBroadcastClient(ns, enums.PortIndex.cncBroadcasting)
	}

	async main(): Promise<void> {
		await runningHackingScripts(this._ns, this._calculator.targetNode.server.hostname)
		// noinspection InfiniteLoopJS
		while (true) {
			const now = new Date().getTime()
			const batchDuration = this._calculator.determineHWGWait()
			// Refresh bounds
			if (now > this._lastRefresh + refreshPeriod) {
				const bounds = await this._broadcastClient.get()
				this._calculator.maxHackPercentage = bounds.maxHackPercentage

				this._maxThreads = await this.determineMaxThreads()
				this._hackPercentage = this._calculator.findHackingPercentage(this._maxThreads)

				this._logger.info(LogType.log, this._batch, ' Max: T %s / H%% %s',
					this._maxThreads, this._ns.nFormat(this._calculator.maxHackPercentage, enums.Format.percentage))
			}

			const calculatedThreads = this._calculator.findThreadCounts(this._hackPercentage)
			const calculatedThreadsTotal = calculateTotalThreads(calculatedThreads)

			// Refresh reservations
			if (now > this._lastRefresh + refreshPeriod || calculatedThreadsTotal < this._reservedThreadsTotal) {
				const reservationTime = batchDuration > refreshPeriod ? batchDuration : refreshPeriod + batchDuration // TODO improve less than calculation
				this._reservations = await this._ramClient.reserveThreads({
					name: 'weaken',
					tickets: calculatedThreads.weaken,
					allocationSize: enums.ScriptCost.weaken,
					duration: reservationTime,
					affinity: {
						hostnames: ['home'],
						anti: false,
						hard: this._calculator.ownsAdditionalCores()
					}
				}, {
					name: 'grow',
					tickets: calculatedThreads.grow,
					allocationSize: enums.ScriptCost.grow,
					duration: reservationTime,
					affinity: {
						hostnames: ['home'],
						anti: false,
						hard: this._calculator.ownsAdditionalCores()
					}
				}, {
					name: 'hack',
					tickets: calculatedThreads.hack,
					allocationSize: enums.ScriptCost.hack,
					duration: reservationTime,
					affinity: {
						hostnames: ['home'],
						anti: true,
						hard: false
					}
				})
				this._reservedThreadsTotal = calculateTotalTickets(Object.values(this._reservations).flat())

				this._lastRefresh = now
			}

			if (calculatedThreads.totalSecurityIncrease > 100 - this._calculator.targetNode.server.minDifficulty) {
				this._logger.warn(LogType.log, this._batch, 'Hitting max security %s / %s',
					this._ns.nFormat(calculatedThreads.totalSecurityIncrease, enums.Format.security),
					this._ns.nFormat(100 - this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Hitting max security', this._calculator.targetNode.server.hostname)
			}

			const startedThreadsWeaken = execReservations(this._ns, this._reservations.weaken, enums.LaunchpadScripts.weaken,
				this._calculator.targetNode.server.hostname)
			const startedThreadsGrow = execReservations(this._ns, this._reservations.grow, enums.LaunchpadScripts.grow,
				this._calculator.targetNode.server.hostname)
			const startedThreadsHack = execReservations(this._ns, this._reservations.hack, enums.LaunchpadScripts.hack,
				this._calculator.targetNode.server.hostname)
			const startedThreadsTotal = startedThreadsWeaken + startedThreadsGrow + startedThreadsHack

			if (startedThreadsTotal !== calculatedThreadsTotal) {
				this._logger.error(LogType.log, this._batch, 'Started threads do not match calculated total threads %s != %s',
					startedThreadsTotal, calculatedThreadsTotal
				)
				this._toaster.error('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}

			if (startedThreadsTotal !== this._reservedThreadsTotal) {
				this._logger.error(LogType.log, this._batch, 'Started threads do not match reserved threads %s != %s',
					startedThreadsTotal, this._reservedThreadsTotal
				)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}

			this._logger.info(LogType.log, this._batch, 'Calc: H %s / G %s / W %s / T %s / H%% %s',
				calculatedThreads.hack, calculatedThreads.grow, calculatedThreads.weaken,
				calculatedThreadsTotal, this._ns.nFormat(this._hackPercentage, enums.Format.percentage)
			)
			this._logger.info(LogType.log, this._batch, ' Acc: H %s / G %s / W %s / T %s / R %s',
				startedThreadsHack, startedThreadsGrow, startedThreadsWeaken,
				startedThreadsTotal, this._reservedThreadsTotal
			)
			this._logger.info(LogType.log, this._batch, 'Duration %s', this._ns.tFormat(batchDuration, true))
			await this._ns.sleep(batchDuration)

			this._calculator.refresh()

			if (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax * 0.5) {
				this._logger.warn(LogType.log, this._batch, 'Encountering heavy money drift %s < %s',
					this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, enums.Format.money),
					this._ns.nFormat(this._calculator.targetNode.server.moneyMax, enums.Format.money)
				)
				this._toaster.warn('Encountering heavy money drift', this._calculator.targetNode.server.hostname)
			} else if (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax * 0.99) {
				this._logger.warn(LogType.log, this._batch, 'Encountering money drift %s < %s',
					this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, enums.Format.money),
					this._ns.nFormat(this._calculator.targetNode.server.moneyMax, enums.Format.money)
				)
			}

			if (this._calculator.targetNode.server.hackDifficulty > this._calculator.targetNode.server.baseDifficulty) {
				this._logger.warn(LogType.log, this._batch, 'Encountering security drift %s > %s',
					this._ns.nFormat(this._calculator.targetNode.server.hackDifficulty, enums.Format.security),
					this._ns.nFormat(this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Encountering security drift', this._calculator.targetNode.server.hostname)
			}

			this._batch++
		}
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this._ramClient.lookupTotalThreads()
		const maxNeededThreads = this._calculator.findThreadCounts()
		return Math.min(maxAvailableThreads, calculateTotalThreads(maxNeededThreads))
	}
}
