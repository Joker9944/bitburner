import {NS} from '@ns'
import {IdentifierLogger, LogType} from '/lib/logging/Logger'
import {Toaster} from '/lib/logging/Toaster'
import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import {HGWThreads} from '/lib/findBatcherThreadCounts'
import {createRamClient, IpcRamClient} from '/daemons/ram/IpcRamClient'
import {Allotments} from "/daemons/ram/RamMessageType";
import {getNetNode} from '/lib/NetNode'
import {runningHackingScripts} from "/lib/runningHackingScripts";
import * as enums from '/lib/enums'
import {createBroadcastClient, IpcBroadcastClient} from "/lib/ipc/broadcast/IpcBroadcastClient";
import {Bounds} from "/daemons/cnc/Bounds";

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

	constructor(ns: NS, targetServerHostname: string, maxHackPercentage: number, hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this._logger = new IdentifierLogger(ns)
		this._toaster = new Toaster(ns)

		const targetNode = getNetNode(ns, targetServerHostname)
		this._calculator = new HGWFormulasCalculator(ns, targetNode, maxHackPercentage, hackPercentageSuggestion, growThreadsSuggestion)

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
				this._logger.info(LogType.log, batch, 'Refreshed settings')
				this._logger.info(LogType.log, batch, 'Max threads: %s, Max hack%%: %s', maxThreads, this._ns.nFormat(this._calculator.maxHackPercentage, enums.Format.percentage))
				lastRefresh = now
			}

			const wait = this._calculator.determineHWGWait() + 200

			const allotments = await this._ramClient.reserveThreads(maxThreads, wait)
			const reservedThreads = Object.values(allotments).reduce((a, b) => a + b)
			const hackPercentage = this._calculator.findHackingPercentage(reservedThreads)
			const threads = this._calculator.findThreadCounts(hackPercentage)

			if (threads.totalSecurityIncrease > 100 - this._calculator.targetNode.server.minDifficulty) {
				this._logger.warn(LogType.log, batch, 'Hitting max security %s / %s',
					this._ns.nFormat(threads.totalSecurityIncrease, enums.Format.security),
					this._ns.nFormat(100 - this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Hitting max security', this._calculator.targetNode.server.hostname)
			}

			const startedThreads = this.startThreads(threads, allotments)
			if (startedThreads !== threads.total()) {
				this._logger.warn(LogType.log, batch, 'Started threads do not match total threads %s != %s',
					startedThreads, threads.total()
				)
				this._toaster.warn('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}

			if (startedThreads > reservedThreads) {
				this._logger.error(LogType.log, batch, 'Started more threads than reserved %s > %s',
					startedThreads, reservedThreads
				)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}

			this._logger.info(LogType.log, batch, 'Hack: %s, Grow: %s, Weaken: %s, Total: %s, Reserved: %s',
				threads.hack, threads.grow, threads.weaken, threads.total(), reservedThreads
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

	startThreads(threads: HGWThreads, allotments: Allotments): number {
		const allotmentsEntries = Object.entries(allotments)

		let startedHack = 0
		let startedGrow = 0
		let startedWeaken = 0
		for (let i = 0; i < allotmentsEntries.length; i++) {
			const hostname = allotmentsEntries[i][0]
			const allotment = allotmentsEntries[i][1]

			let started = 0
			while (started < allotment && startedHack + startedGrow + startedWeaken < threads.total()) {
				if (started < allotment && startedWeaken < threads.weaken) {
					const threadsWeaken =
						threads.weaken - startedWeaken > allotment ? allotment : threads.weaken - startedWeaken
					// TODO improve exec error detection
					this._ns.exec(
						enums.LaunchpadScripts.weaken,
						hostname,
						threadsWeaken,
						this._calculator.targetNode.server.hostname
					)
					startedWeaken += threadsWeaken
					started += threadsWeaken
				}
				if (started < allotment && startedGrow < threads.grow) {
					const threadsGrow = threads.grow - startedGrow > allotment ? allotment : threads.grow - startedGrow
					this._ns.exec(
						enums.LaunchpadScripts.grow,
						hostname,
						threadsGrow,
						this._calculator.targetNode.server.hostname
					)
					startedGrow += threadsGrow
					started += threadsGrow
				}
				if (started < allotment && startedHack < threads.hack) {
					const threadsHack = threads.hack - startedHack > allotment ? allotment : threads.hack - startedHack
					this._ns.exec(
						enums.LaunchpadScripts.hack,
						hostname,
						threadsHack,
						this._calculator.targetNode.server.hostname
					)
					startedHack += threadsHack
					started += threadsHack
				}
			}
		}

		return startedHack + startedGrow + startedWeaken
	}
}
