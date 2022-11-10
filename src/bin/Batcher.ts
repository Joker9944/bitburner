import {NS} from '@ns'
import {IdentifierLogger, LogType} from '/lib/logging/Logger'
import {Toaster} from '/lib/logging/Toaster'
import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import {createRamClient, IpcRamClient} from '/daemons/ram/IpcRamClient'
import {calculateTotalTickets} from "/daemons/ram/RamMessageType";
import {execReservations} from "/daemons/ram/execReservations";
import {createBroadcastClient, IpcBroadcastClient} from "/lib/ipc/broadcast/IpcBroadcastClient";
import {Bounds} from "/daemons/cnc/Bounds";
import {getNetNode} from '/lib/NetNode'
import {runningHackingScripts} from "/lib/runningHackingScripts";
import * as enums from '/lib/enums'

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

	constructor(ns: NS, targetServerHostname: string, maxHackPercentage: number,
	            hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this._logger = new IdentifierLogger(ns)
		this._toaster = new Toaster(ns)

		const targetNode = getNetNode(ns, targetServerHostname)
		this._calculator = new HGWFormulasCalculator(ns, targetNode,
			maxHackPercentage, hackPercentageSuggestion, growThreadsSuggestion)

		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
		this._broadcastClient = createBroadcastClient(ns, enums.PortIndex.cncBroadcasting)
	}

	async main(): Promise<void> {
		await runningHackingScripts(this._ns, this._calculator.targetNode.server.hostname)
		let maxThreads = 0
		let batch = 0
		let lastRefresh = 0
		// noinspection InfiniteLoopJS
		while (true) {
			const now = new Date().getTime()
			if (now > lastRefresh + refreshPeriod) {
				const data = await this._broadcastClient.get()
				this._calculator.maxHackPercentage = data.maxHackPercentage
				maxThreads = await this.determineMaxThreads()
				this._logger.info(LogType.log, batch, 'Max threads: %s, Max hack%%: %s',
					maxThreads, this._ns.nFormat(this._calculator.maxHackPercentage, enums.Format.percentage))
				lastRefresh = now
			}

			const wait = this._calculator.determineHWGWait() + 200

			const hackPercentage = this._calculator.findHackingPercentage(maxThreads)
			const calculatedThreads = this._calculator.findThreadCounts(hackPercentage)

			if (calculatedThreads.totalSecurityIncrease > 100 - this._calculator.targetNode.server.minDifficulty) {
				this._logger.warn(LogType.log, batch, 'Hitting max security %s / %s',
					this._ns.nFormat(calculatedThreads.totalSecurityIncrease, enums.Format.security),
					this._ns.nFormat(100 - this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Hitting max security', this._calculator.targetNode.server.hostname)
			}

			const reservations = await this._ramClient.reserveThreads({
				name: 'weaken',
				tickets: calculatedThreads.weaken,
				allocationSize: enums.ScriptCost.weaken,
				duration: wait
			}, {
				name: 'grow',
				tickets: calculatedThreads.grow,
				allocationSize: enums.ScriptCost.grow,
				duration: wait
			}, {
				name: 'hack',
				tickets: calculatedThreads.hack,
				allocationSize: enums.ScriptCost.hack,
				duration: wait
			})
			const reservedThreadsTotal = calculateTotalTickets(Object.values(reservations).flat())

			const startedThreadsWeaken = execReservations(this._ns, reservations.weaken, enums.LaunchpadScripts.weaken,
				this._calculator.targetNode.server.hostname);
			const startedThreadsGrow = execReservations(this._ns, reservations.grow, enums.LaunchpadScripts.grow,
				this._calculator.targetNode.server.hostname);
			const startedThreadsHack = execReservations(this._ns, reservations.hack, enums.LaunchpadScripts.hack,
				this._calculator.targetNode.server.hostname);
			const startedThreadsTotal = startedThreadsWeaken + startedThreadsGrow + startedThreadsHack

			if (startedThreadsTotal !== calculatedThreads.total()) {
				this._logger.error(LogType.log, batch, 'Started threads do not match calculated total threads %s != %s',
					startedThreadsTotal, calculatedThreads.total()
				)
				this._toaster.error('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}

			if (startedThreadsTotal !== reservedThreadsTotal) {
				this._logger.error(LogType.log, batch, 'Started threads do not match reserved threads %s != %s',
					startedThreadsTotal, reservedThreadsTotal
				)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}

			this._logger.info(LogType.log, batch, 'Hack: %s, Grow: %s, Weaken: %s, Total: %s, Reserved: %s',
				calculatedThreads.hack, calculatedThreads.grow, calculatedThreads.weaken,
				calculatedThreads.total(), reservedThreadsTotal
			)
			this._logger.info(LogType.log, batch, 'Hack%%: %s',
				this._ns.nFormat(hackPercentage, enums.Format.percentage)
			)
			this._logger.info(LogType.log, batch, 'Duration %s', this._ns.tFormat(wait, true))
			await this._ns.sleep(wait)

			this._calculator.refresh()

			if (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax * 0.5) {
				this._logger.warn(LogType.log, batch, 'Encountering heavy money drift %s < %s',
					this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, enums.Format.money),
					this._ns.nFormat(this._calculator.targetNode.server.moneyMax, enums.Format.money)
				)
				this._toaster.warn('Encountering heavy money drift', this._calculator.targetNode.server.hostname)
			} else if (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax * 0.99) {
				this._logger.warn(LogType.log, batch, 'Encountering money drift %s < %s',
					this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, enums.Format.money),
					this._ns.nFormat(this._calculator.targetNode.server.moneyMax, enums.Format.money)
				)
			}

			if (this._calculator.targetNode.server.hackDifficulty > this._calculator.targetNode.server.baseDifficulty) {
				this._logger.warn(LogType.log, batch, 'Encountering security drift %s > %s',
					this._ns.nFormat(this._calculator.targetNode.server.hackDifficulty, enums.Format.security),
					this._ns.nFormat(this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Encountering security drift', this._calculator.targetNode.server.hostname)
			}

			batch++
		}
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this._ramClient.lookupTotalThreads()
		const maxNeededThreads = this._calculator.findMaxThreadCounts().total()
		return Math.min(maxAvailableThreads, maxNeededThreads)
	}
}
