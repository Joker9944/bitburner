import {NS} from '@ns'
import {IdentifierLogger, LogType} from "/lib/logging/Logger"
import {Toaster} from "/lib/logging/Toaster"
import {FlufferCalculator} from "/lib/FlufferCalculator"
import {createRamClient, IpcRamClient} from "/daemons/ram/IpcRamClient"
import {createBroadcastClient, IpcBroadcastClient} from "/lib/ipc/broadcast/IpcBroadcastClient"
import {Bounds} from "/daemons/cnc/Bounds"
import {runningHackingScripts} from "/lib/runningHackingScripts"
import {execReservations} from "/daemons/ram/execReservations"
import {calculateTotalTickets} from "/daemons/ram/RamMessageType"
import * as enums from "/lib/enums"

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

		this._calculator = new FlufferCalculator(ns, targetServerHostname)

		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
		this._broadcastClient = createBroadcastClient(ns, enums.PortIndex.cncBroadcasting)
	}

	async main(): Promise<void> {
		await runningHackingScripts(this._ns, this._calculator.targetNode.server.hostname)


		let weakenBatch = 0
		while (this._calculator.targetNode.server.hackDifficulty > this._calculator.targetNode.server.minDifficulty) {
			const maxThreads = await this.determineMaxThreads()
			const securityDecrease = this._calculator.calculateSecurityDecrease()

			let calculatedThreads = this._calculator.calculateNeededWeakenThreads(securityDecrease)
			if (calculatedThreads > maxThreads) {
				this._logger.warn(LogType.log, 'weaken-' + weakenBatch, 'Weaken thread count hit limit %s > %s',
					calculatedThreads, maxThreads)
				calculatedThreads = maxThreads
			}

			const wait = this._calculator.determineWWait() + 200

			const reservation = (await this._ramClient.reserveThreads({
				name: 'weaken',
				tickets: calculatedThreads,
				allocationSize: enums.ScriptCost.weaken,
				duration: wait,
				affinity: {
					hostnames: ['home'],
					anti: false,
					hard: this._calculator.ownsAdditionalCores()
				}
			})).weaken
			const reservedThreads = calculateTotalTickets(reservation)

			const startedThreads = execReservations(this._ns, reservation, enums.LaunchpadScripts.weaken,
				this._calculator.targetNode.server.hostname);

			if (startedThreads !== calculatedThreads) {
				this._logger.error(LogType.log, 'weaken-' + weakenBatch,
					'Started threads do not match calculated total threads %s != %s',
					startedThreads, calculatedThreads
				)
				this._toaster.error('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}

			if (startedThreads !== reservedThreads) {
				this._logger.error(LogType.log, 'weaken-' + weakenBatch,
					'Started threads do not match reserved threads %s != %s',
					startedThreads, reservedThreads
				)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}
			const exceptedSecurity = this._calculator.targetNode.server.hackDifficulty - this._calculator.targetNode.server.minDifficulty - calculatedThreads * securityDecrease
			this._logger.info(LogType.log, 'weaken-' + weakenBatch, 'Excepted outcome %s/%s',
				this._ns.nFormat(Math.max(exceptedSecurity, 0), enums.Format.security),
				100 - this._calculator.targetNode.server.minDifficulty)
			this._logger.info(LogType.log, 'weaken-' + weakenBatch, 'W %s / R %s',
				calculatedThreads, reservedThreads)
			this._logger.info(LogType.log, 'weaken-' + weakenBatch, 'Duration %s',
				this._ns.tFormat(wait, true))

			await this._ns.sleep(wait)

			this._calculator.refresh()

			this._logger.info(LogType.log, 'weaken-' + weakenBatch, 'Actual outcome: %s/%s',
				this._ns.nFormat(this._calculator.targetNode.server.hackDifficulty - this._calculator.targetNode.server.minDifficulty, enums.Format.security),
				100 - this._calculator.targetNode.server.minDifficulty
			)

			weakenBatch++
		}

		let growBatch = 0
		while (this._calculator.targetNode.server.moneyAvailable < this._calculator.targetNode.server.moneyMax) {
			const maxThreads = await this.determineMaxThreads()
			const calculatedThreadsGrow = Math.floor(maxThreads * 0.9) // TODO find a way to improve this
			const securityDecrease = this._calculator.calculateSecurityDecrease()
			const securityDeficit = this._ns.growthAnalyzeSecurity(calculatedThreadsGrow)
			const calculatedThreadsWeaken = Math.ceil(securityDeficit / securityDecrease)
			const calculatedTotal = calculatedThreadsGrow + calculatedThreadsWeaken

			const wait = this._calculator.determineWGWait() + 200

			const reservations = await this._ramClient.reserveThreads({
				name: 'weaken',
				tickets: calculatedThreadsWeaken,
				allocationSize: enums.ScriptCost.weaken,
				duration: wait,
				affinity: {
					hostnames: ['home'],
					anti: false,
					hard: this._calculator.ownsAdditionalCores()
				}
			}, {
				name: 'grow',
				tickets: calculatedThreadsGrow,
				allocationSize: enums.ScriptCost.grow,
				duration: wait,
				affinity: {
					hostnames: ['home'],
					anti: false,
					hard: false
				}
			})
			const reservedThreadsTotal = calculateTotalTickets(Object.values(reservations).flat())

			const startedThreadsWeaken = execReservations(this._ns, reservations.weaken, enums.LaunchpadScripts.weaken,
				this._calculator.targetNode.server.hostname);
			const startedThreadsGrow = execReservations(this._ns, reservations.grow, enums.LaunchpadScripts.grow,
				this._calculator.targetNode.server.hostname);
			const startedThreadsTotal = startedThreadsWeaken + startedThreadsGrow

			if (startedThreadsTotal !== calculatedTotal) {
				this._logger.error(LogType.log, 'grow-' + growBatch,
					'Started threads do not match calculated total threads %s != %s',
					startedThreadsTotal, calculatedTotal
				)
				this._toaster.error('Started thread mismatch', this._calculator.targetNode.server.hostname)
			}

			if (startedThreadsTotal !== reservedThreadsTotal) {
				this._logger.error(LogType.log, 'grow-' + growBatch,
					'Started threads do not match reserved threads %s != %s',
					startedThreadsTotal, reservedThreadsTotal
				)
				this._toaster.error('Reservation mismatch', this._calculator.targetNode.server.hostname)
			}

			this._logger.info(LogType.log, 'grow-' + growBatch, 'G %s / W %s / R %s',
				calculatedThreadsGrow, calculatedThreadsWeaken, reservedThreadsTotal)
			this._logger.info(LogType.log, 'grow-' + growBatch, 'Duration %s',
				this._ns.tFormat(wait, true))

			await this._ns.sleep(wait)

			this._calculator.refresh()

			this._logger.info(LogType.log, 'grow-' + growBatch, 'Outcome: %s/%s', // TODO implement outcome prediction
				this._ns.nFormat(this._calculator.targetNode.server.moneyAvailable, '$0.000a'),
				this._ns.nFormat(this._calculator.targetNode.server.moneyMax, '$0.000a')
			)

			growBatch++
		}
		await this._ramClient.releaseReservations()
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this._ramClient.lookupTotalThreads()
		const maxNeededThreads = (await this._broadcastClient.get()).maxThreads
		return Math.min(maxAvailableThreads, maxNeededThreads)
	}
}
