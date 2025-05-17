import {AutocompleteData, NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {Toaster} from '/lib/logging/Toaster'
import {FlufferCalculator} from '/lib/FlufferCalculator'
import {createRamClient, IpcRamClient} from '/daemons/ram/IpcRamClient'
import {createBroadcastClient, IpcBroadcastClient} from '/lib/ipc/broadcast/IpcBroadcastClient'
import {Bounds} from '/daemons/cnc/Bounds'
import {runningHackingScripts} from '/lib/runningHackingScripts'
import {execReservations} from '/daemons/ram/execReservations'
import {calculateTotalTickets} from '/daemons/ram/RamMessageType'
import {positionalArgument} from '/lib/positionalArgument'
import * as enums from '/lib/enums'
import {Formatter} from "/lib/logging/Formatter";

const identifierPrefix = 'fluffer-'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	return [...data.servers]
}

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const args = ns.flags([])
	const targetServerHostname = positionalArgument(args, 0, 'n00dles') as string

	await new Fluffer(ns, targetServerHostname).main()
}

class Fluffer {
	private readonly _ns: NS

	private readonly _formatter: Formatter
	private readonly _logger: Logger
	private readonly _toaster: Toaster

	private readonly _calculator: FlufferCalculator
	private readonly _ramClient: IpcRamClient
	private readonly _broadcastClient: IpcBroadcastClient<Bounds>

	constructor(ns: NS, targetServerHostname: string) {
		this._ns = ns

		this._formatter = new Formatter(ns)
		this._logger = new Logger(ns)
		this._toaster = new Toaster(ns)

		this._calculator = new FlufferCalculator(ns, ns.getServer(targetServerHostname))
		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
		this._broadcastClient = createBroadcastClient(ns, enums.PortIndex.cncBroadcasting)
	}

	async main(): Promise<void> {
		await runningHackingScripts(this._ns, this._calculator.targetServer.hostname)

		let weakenBatch = 1
		while (this._calculator.targetServer.hackDifficulty! > this._calculator.targetServer.minDifficulty!) {
			const maxThreads = await this.determineMaxThreads()
			const securityDecrease = this._calculator.calculateSecurityDecrease()

			let calculatedThreads = this._calculator.calculateNeededWeakenThreads(securityDecrease)
			if (calculatedThreads > maxThreads) {
				this._logger.warn()
					.withIdentifier('weaken-' + weakenBatch)
					.withFormat('Weaken thread count hit limit %s > %s')
					.print(calculatedThreads, maxThreads)
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
				this._calculator.targetServer.hostname);

			if (startedThreads !== calculatedThreads) {
				this._logger.error()
					.withIdentifier('weaken-' + weakenBatch)
					.withFormat('Started threads do not match calculated total threads %s != %s')
					.print(startedThreads, calculatedThreads)
				this._toaster.error('Started thread mismatch', this._calculator.targetServer.hostname)
			}

			if (startedThreads !== reservedThreads) {
				this._logger.error()
					.withIdentifier('weaken-' + weakenBatch)
					.withFormat('Started threads do not match reserved threads %s != %s')
					.print(startedThreads, reservedThreads)
				this._toaster.error('Reservation mismatch', this._calculator.targetServer.hostname)
			}
			const exceptedSecurity = this._calculator.targetServer.hackDifficulty! - this._calculator.targetServer.minDifficulty! - calculatedThreads * securityDecrease
			this._logger.info()
				.withIdentifier('weaken-' + weakenBatch)
				.withFormat('Excepted outcome %s/%s')
				.print(this._formatter.security(Math.max(exceptedSecurity, 0)),
					this._formatter.security(100 - this._calculator.targetServer.minDifficulty!)
				)
			this._logger.info()
				.withIdentifier('weaken-' + weakenBatch)
				.withFormat('W %s / R %s')
				.print(calculatedThreads, reservedThreads)
			this._logger.info()
				.withIdentifier('weaken-' + weakenBatch)
				.withFormat('Duration %s')
				.print(this._ns.tFormat(wait, true))

			await this._ns.sleep(wait)

			this._calculator.update()

			this._logger.info()
				.withIdentifier('weaken-' + weakenBatch)
				.withFormat('Actual outcome: %s/%s')
				.print(this._formatter.security(this._calculator.targetServer.hackDifficulty! - this._calculator.targetServer.minDifficulty!),
					this._formatter.security(100 - this._calculator.targetServer.minDifficulty!)
				)

			weakenBatch++
		}

		let growBatch = 1
		while (this._calculator.targetServer.moneyAvailable! < this._calculator.targetServer.moneyMax!) {
			const maxThreads = await this.determineMaxThreads()
			const calculatedThreadsGrow = Math.floor(maxThreads * 0.9) // TODO find a way to improve this
			const securityDecrease = this._calculator.calculateSecurityDecrease()
			const securityDeficit = calculatedThreadsGrow * enums.Security.growIncrease
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
				this._calculator.targetServer.hostname);
			const startedThreadsGrow = execReservations(this._ns, reservations.grow, enums.LaunchpadScripts.grow,
				this._calculator.targetServer.hostname);
			const startedThreadsTotal = startedThreadsWeaken + startedThreadsGrow

			if (startedThreadsTotal !== calculatedTotal) {
				this._logger.error()
					.withIdentifier('grow-' + growBatch)
					.withFormat('Started threads do not match calculated total threads %s != %s')
					.print(startedThreadsTotal, calculatedTotal)
				this._toaster.error('Started thread mismatch', this._calculator.targetServer.hostname)
			}

			if (startedThreadsTotal !== reservedThreadsTotal) {
				this._logger.error()
					.withIdentifier('grow-' + growBatch)
					.withFormat('Started threads do not match reserved threads %s != %s')
					.print(startedThreadsTotal, reservedThreadsTotal)
				this._toaster.error('Reservation mismatch', this._calculator.targetServer.hostname)
			}

			this._logger.info()
				.withIdentifier('grow-' + growBatch)
				.withFormat('G %s / W %s / R %s')
				.print(calculatedThreadsGrow, calculatedThreadsWeaken, reservedThreadsTotal)
			this._logger.info()
				.withIdentifier('grow-' + growBatch)
				.withFormat('Duration %s')
				.print(this._ns.tFormat(wait, true))

			await this._ns.sleep(wait)

			this._calculator.update()

			this._logger.info() // TODO implement outcome prediction
				.withIdentifier('grow-' + growBatch)
				.withFormat('Outcome: %s/%s')
				.print(this._formatter.money(this._calculator.targetServer.moneyAvailable!),
					this._formatter.money(this._calculator.targetServer.moneyMax!)
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
