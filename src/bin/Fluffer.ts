import {NS} from '@ns'
import {IdentifierLogger, LogType} from "/lib/logging/Logger";
import {Toaster} from "/lib/logging/Toaster";
import {createRamClient, IpcRamClient} from "/daemons/ram/IpcRamClient";
import {createBroadcastClient, IpcBroadcastClient} from "/lib/ipc/broadcast/IpcBroadcastClient";
import {Bounds} from "/daemons/cnc/Bounds";
import {getNetNode} from "/lib/NetNode";
import * as enums from "/lib/enums";
import {runningHackingScripts} from "/lib/runningHackingScripts";
import {FlufferCalculator} from "/lib/FlufferCalculator";
import {Allotments} from "/daemons/ram/RamMessageType";

const identifierPrefix = 'fluffer-'

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const args = ns.flags([])
	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]

	await new Fluffer(ns, targetServerHostname).main()
}

class Fluffer {
	private readonly _ns: NS

	private readonly _logger: IdentifierLogger
	private readonly _toaster: Toaster

	private readonly _calculator: FlufferCalculator
	private readonly _ramClient: IpcRamClient
	private readonly _broadcastClient: IpcBroadcastClient<Bounds>

	constructor(ns: NS, targetServerHostname: string) {
		this._ns = ns

		this._logger = new IdentifierLogger(ns)
		this._toaster = new Toaster(ns)

		const targetNode = getNetNode(ns, targetServerHostname)
		this._calculator = new FlufferCalculator(ns, targetNode)

		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
		this._broadcastClient = createBroadcastClient(ns, enums.PortIndex.cncBroadcasting)
	}

	async main(): Promise<void> {
		await runningHackingScripts(this._ns, this._calculator.targetNode.server.hostname)

		const maxThreads = await this.determineMaxThreads()

		let weakenBatch = 0
		while (this._calculator.targetNode.server.hackDifficulty > this._calculator.targetNode.server.minDifficulty) {
			const securityDecrease = this._calculator.calculateSecurityDecrease()
			let threads = this._calculator.calculateNeededWeakenThreads(securityDecrease)
			if (threads > maxThreads) {
				this._logger.warn(LogType.log, weakenBatch, 'Weaken thread count hit limit %s > %s', threads, maxThreads)
				threads = maxThreads
			}

			const wait = this._calculator.determineWWait() + 200

			const allotments = await this._ramClient.reserveThreads(threads, wait)
			const reservedThreads = Object.values(allotments).reduce((a, b) => a + b)

			const startedThreads = this.startWeakenThreads(allotments)

			if (startedThreads !== reservedThreads) {
				this._logger.warn(LogType.log, weakenBatch, 'Started threads do not match reserved threads %s != %s',
					startedThreads, reservedThreads
				)
				this._toaster.warn('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}
			const exceptedSecurity = this._calculator.targetNode.server.hackDifficulty - this._calculator.targetNode.server.minDifficulty - threads * securityDecrease
			this._logger.info(LogType.log, weakenBatch, 'Excepted outcome %s/%s',
				Math.max(exceptedSecurity, 0),
				100 - this._calculator.targetNode.server.minDifficulty)
			this._logger.info(LogType.log, weakenBatch, 'Weaken: %s, Reserved: %s', threads, reservedThreads)
			this._logger.info(LogType.log, weakenBatch, 'Duration %s', this._ns.tFormat(wait, true))

			await this._ns.sleep(wait)

			this._calculator.refresh()

			this._logger.info(LogType.log, weakenBatch, 'Actual outcome: %s/%s',
				this._calculator.targetNode.server.hackDifficulty - this._calculator.targetNode.server.minDifficulty,
				100 - this._calculator.targetNode.server.minDifficulty
			)

			weakenBatch++
		}

		// TODO find a way to improve this
		const growThreads = Math.floor(maxThreads * 0.9)

		let growBatch = 0
		while (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax) {
			const securityDecrease = this._calculator.calculateSecurityDecrease()
			const securityDeficit = this._ns.growthAnalyzeSecurity(growThreads)
			const weakenThreads = Math.ceil(securityDeficit / securityDecrease)

			const wait = this._calculator.determineWGWait() + 200

			const allotments = await this._ramClient.reserveThreads(growThreads + weakenThreads, wait)
			const reservedThreads = Object.values(allotments).reduce((a, b) => a + b)

			const startedThreads = this.startThreads(weakenThreads, growThreads, allotments)

			if (startedThreads !== reservedThreads) {
				this._logger.warn(LogType.log, growBatch, 'Started threads do not match reserved threads %s != %s',
					startedThreads, reservedThreads
				)
				this._toaster.warn('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}
			this._logger.info(LogType.log, growBatch, 'Weaken: %s, Grow: %s, Reserved: %s', weakenThreads, growThreads, reservedThreads)
			this._logger.info(LogType.log, growBatch, 'Duration %s', this._ns.tFormat(wait, true))

			await this._ns.sleep(wait)

			this._calculator.refresh()

			this._logger.info(LogType.log, growBatch, 'outcome: %s/%s',
				this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, '$0.000a'),
				this._ns.nFormat(this._calculator.targetNode.server.moneyMax, '$0.000a')
			)

			growBatch++
		}
		await this._ramClient.releaseReservations()
	}

	startWeakenThreads(allotments: Allotments): number {
		const allotmentsEntries = Object.entries(allotments)

		let startedWeaken = 0
		for (const entry of allotmentsEntries) {
			this._ns.exec(
				enums.LaunchpadScripts.weaken,
				entry[0],
				entry[1],
				this._calculator.targetNode.server.hostname
			)
			startedWeaken += entry[1]
		}

		return startedWeaken
	}

	startThreads(weakenThreads: number, growThreads: number, allotments: Allotments): number {
		const allotmentsEntries = Object.entries(allotments)

		let startedGrow = 0
		let startedWeaken = 0
		for (let i = 0; i < allotmentsEntries.length; i++) {
			const hostname = allotmentsEntries[i][0]
			const allotment = allotmentsEntries[i][1]

			let started = 0
			while (started < allotment && startedGrow + startedWeaken < weakenThreads + growThreads) {
				if (started < allotment && startedWeaken < weakenThreads) {
					const threads = weakenThreads - startedWeaken > allotment ? allotment : weakenThreads - startedWeaken
					this._ns.exec(
						enums.LaunchpadScripts.weaken,
						hostname,
						threads,
						this._calculator.targetNode.server.hostname
					)
					startedWeaken += threads
					started += threads
				}
				if (started < allotment && startedGrow < growThreads) {
					const threads = growThreads - startedGrow > allotment ? allotment : growThreads - startedGrow
					this._ns.exec(
						enums.LaunchpadScripts.grow,
						hostname,
						threads,
						this._calculator.targetNode.server.hostname
					)
					startedGrow += threads
					started += threads
				}
			}
		}

		return startedGrow + startedWeaken
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this._ramClient.lookupTotalThreads()
		const maxNeededThreads = (await this._broadcastClient.get()).maxThreads
		return Math.min(maxAvailableThreads, maxNeededThreads)
	}
}
