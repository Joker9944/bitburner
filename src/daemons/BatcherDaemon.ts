import { NS } from '@ns'
import { IdentifierLogger, LogType } from 'lib/logging/Logger'
import { Toaster } from 'lib/logging/Toaster'
import { HGWFormulasCalculator } from 'lib/HGWFormulasCalculator'
import { ramManagerIdentifier, RamManagerCommand, RamManagerMessage } from 'daemons/RamManagerDaemon'
import { IpcClient } from 'lib/ipc/IpcClient'
import { getNetNode } from '/lib/NetNode'
import * as enums from 'lib/enums'
import { HGWThreads } from '/lib/findBatcherThreadCounts'

const identifierPrefix = 'batcher-'

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

	await new BatcherDaemon(
		ns,
		targetServerHostname,
		maxHackPercentage,
		hackPercentageSuggestion,
		growThreadsSuggestion
	).run()
}

class BatcherDaemon {
	private _logger: IdentifierLogger
	private _toaster: Toaster

	private _ns: NS
	private _maxHackPercentage: number

	private _calculator: HGWFormulasCalculator
	private _client: IpcClient<RamManagerMessage>

	constructor(
		ns: NS,
		targetServerHostname: string,
		maxHackPercentage: number,
		hackPercentageSuggestion: number,
		growThreadsSuggestion: number
	) {
		this._ns = ns
		this._maxHackPercentage = maxHackPercentage

		this._logger = new IdentifierLogger(ns)
		this._toaster = new Toaster(ns)

		const targetNode = getNetNode(ns, targetServerHostname)
		this._calculator = new HGWFormulasCalculator(
			ns,
			targetNode,
			maxHackPercentage,
			hackPercentageSuggestion,
			growThreadsSuggestion
		)

		const identifier = identifierPrefix + targetServerHostname
		this._client = new IpcClient<RamManagerMessage>(ns, identifier, enums.PortIndex.ramManager)
	}

	async run(): Promise<void> {
		let maxThreads = 0
		let batch = 0
		while (true) {
			if (batch % 10 === 0) {
				maxThreads = await this.determineMaxThreads()
			}

			const wait = this._calculator.determineWait()

			const allotments = await this.reserveThreads(maxThreads)
			const reservedThreads = Object.values(allotments).reduce((a, b) => a + b)
			const hackPercentage = this._calculator.findHackingPercentage(reservedThreads, 2)
			const threads = this._calculator.findThreadCounts(hackPercentage, 2)

			if (threads.totalSecurityIncrease > 100 - this._calculator.targetNode.server.minDifficulty) {
				this._logger.warn(
					LogType.log,
					batch,
					'Hitting max security %s / %s',
					this._ns.nFormat(threads.totalSecurityIncrease, enums.Format.security),
					this._ns.nFormat(100 - this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Hitting max security', this._calculator.targetNode.server.hostname)
			}

			const startedThreads = this.startThreads(threads, allotments)
			if (startedThreads !== threads.total()) {
				this._logger.warn(
					LogType.log,
					batch,
					'Started threads does not match total threads %s != %s',
					startedThreads,
					threads.total()
				)
				this._toaster.warn('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}

			if (startedThreads > reservedThreads) {
				this._logger.error(
					LogType.log,
					batch,
					'Started more threads than reserved %s > %s',
					startedThreads,
					reservedThreads
				)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}

			this._logger.info(
				LogType.log,
				batch,
				'HGW: %s / %s / %s / %s, Duration: %s',
				threads.hack,
				threads.grow,
				threads.weaken,
				threads.total(),
				this._ns.tFormat(wait, true)
			)
			await this._ns.sleep(wait)

			if (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax) {
				this._logger.warn(
					LogType.log,
					batch,
					'Encountering money drift %s < %s',
					this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, enums.Format.money),
					this._ns.nFormat(this._calculator.targetNode.server.moneyMax, enums.Format.money)
				)
				this._toaster.warn('Encountering money drift', this._calculator.targetNode.server.hostname)
			}

			if (this._calculator.targetNode.server.hackDifficulty > this._calculator.targetNode.server.baseDifficulty) {
				this._logger.warn(
					LogType.log,
					batch,
					'Encountering security drift %s > %s',
					this._ns.nFormat(this._calculator.targetNode.server.hackDifficulty, enums.Format.security),
					this._ns.nFormat(this._calculator.targetNode.server.minDifficulty, enums.Format.security)
				)
				this._toaster.warn('Encountering security drift', this._calculator.targetNode.server.hostname)
			}

			this._calculator.refresh()
			batch++
		}
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this.lookupMaxThreads()
		const maxNeededThreads = this._calculator.findThreadCounts(this._maxHackPercentage, 2).total()
		return Math.min(maxAvailableThreads, maxNeededThreads)
	}

	startThreads(threads: HGWThreads, allotments: Record<string, number>): number {
		const allotmentsEntries = Object.entries(allotments)

		let startedHack = 0
		let startedGrow = 0
		let startedWeaken = 0
		for (let i = 0; i < allotmentsEntries.length; i++) {
			const hostname = allotmentsEntries[i][0]
			const allotment = allotmentsEntries[i][1]

			let started = 0
			while (started < allotment && started < threads.total()) {
				if (started < allotment && startedWeaken < threads.weaken) {
					const threadsWeaken =
						threads.weaken - startedWeaken > allotment ? allotment : threads.weaken - startedWeaken
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

	// --- client interactions ---

	async reserveThreads(threads: number): Promise<Record<string, number>> {
		await this._client.send(ramManagerIdentifier, new RamManagerMessage(RamManagerCommand.releaseReservation))

		await this._client.send(
			ramManagerIdentifier,
			new RamManagerMessage(RamManagerCommand.requestReservation, {
				requestedRam: threads * enums.ScriptCost.launchpadScripts,
				allocationSize: enums.ScriptCost.launchpadScripts,
			})
		)

		const response = await this._client.receive()
		switch (response.payload.command) {
			case RamManagerCommand.grantReservation: {
				const data = response.payload.data as Record<string, number>
				const entries = Object.entries(data).map((entry) => [entry[0], this.mapRamToThreads(entry[1])])
				return Object.fromEntries(entries)
				break
			}
			case RamManagerCommand.rejectReservation: {
				this._logger.error(LogType.log, 'client', 'Reservation got rejected')
				throw new Error('Reservation got rejected')
			}
			default: {
				this._logger.error(LogType.log, 'client', 'Could not handle %s command', response.payload.command)
				throw new Error(response.payload.command.toString())
			}
		}
	}

	async lookupMaxThreads(): Promise<number> {
		await this._client.send(
			ramManagerIdentifier,
			new RamManagerMessage(RamManagerCommand.lookupFreeRamByAllotments, {
				allocationSize: enums.ScriptCost.launchpadScripts,
			})
		)

		const response = await this._client.receive()
		switch (response.payload.command) {
			case RamManagerCommand.lookupFreeRamByAllotments: {
				return Object.values(response.payload.data as Record<string, number>)
					.map(this.mapRamToThreads)
					.reduce((a, b) => a + b)
				break
			}
			default: {
				this._logger.error(LogType.log, 'client', 'Could not handle %s command', response.payload.command)
				throw new Error(response.payload.command.toString())
			}
		}
	}

	mapRamToThreads(ram: number): number {
		return Math.floor(ram / enums.ScriptCost.launchpadScripts)
	}
}
