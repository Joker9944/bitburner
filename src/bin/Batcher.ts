import {AutocompleteData, NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {Toaster} from '/lib/logging/Toaster'
import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import {createRamClient, IpcRamClient} from '/daemons/ram/IpcRamClient'
import {calculateTotalTickets, ReservationsByKey} from '/daemons/ram/RamMessageType'
import {execReservations} from '/daemons/ram/execReservations'
import {createBroadcastClient, IpcBroadcastClient} from '/lib/ipc/broadcast/IpcBroadcastClient'
import {Bounds} from '/daemons/cnc/Bounds'
import {runningHackingScripts} from '/lib/runningHackingScripts'
import {calculateTotalThreads, HGWThreads} from '/lib/formulas/findBatcherThreadCounts'
import {positionalArgument} from '/lib/positionalArgument';
import {ArgsSchema} from '/lib/ArgsSchema';
import * as enums from '/lib/enums'
import {Formatter} from "/lib/logging/Formatter";

const identifierPrefix = 'batcher-'
const refreshPeriod = 60000

enum Args {
	hackPercentageSuggestion = 'hack-percentage-suggestion',
	growThreadSuggestion = 'grow-thread-suggestion',
}

export const argsSchema = [
	[enums.CommonArgs.maxHackPercentage, 0.3],
	[Args.hackPercentageSuggestion, 0.2],
	[Args.growThreadSuggestion, 200],
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return [...data.servers]
}

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const args = ns.flags(argsSchema)
	const maxHackPercentage = args[enums.CommonArgs.maxHackPercentage] as number
	const hackPercentageSuggestion = args[Args.hackPercentageSuggestion] as number
	const growThreadsSuggestion = args[Args.growThreadSuggestion] as number
	const targetServerHostname = positionalArgument(args, 0, 'n00dles') as string

	await new Batcher(ns, targetServerHostname, maxHackPercentage, hackPercentageSuggestion, growThreadsSuggestion).main()
}

class Batcher {
	private readonly _ns: NS

	private readonly _formatter: Formatter
	private readonly _logger: Logger
	private readonly _toaster: Toaster

	private readonly _calculator: HGWFormulasCalculator
	private readonly _ramClient: IpcRamClient
	private readonly _broadcastClient: IpcBroadcastClient<Bounds>

	private _maxThreads = 0
	private _reservations: ReservationsByKey = {}
	private _reservedThreadsTotal = 0
	private _hackPercentage = 0
	private _lastRefresh = (-refreshPeriod) - 1
	private _batch = 1

	constructor(ns: NS, targetServerHostname: string, maxHackPercentage: number,
				hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this._formatter = new Formatter(ns)
		this._logger = new Logger(ns)
		this._toaster = new Toaster(ns)

		this._calculator = new HGWFormulasCalculator(ns, ns.getServer(targetServerHostname),
			maxHackPercentage, hackPercentageSuggestion, growThreadsSuggestion)
		this._ramClient = createRamClient(ns, identifierPrefix + targetServerHostname)
		this._broadcastClient = createBroadcastClient(ns, enums.PortIndex.cncBroadcasting)
	}

	async main(): Promise<void> {
		await runningHackingScripts(this._ns, this._calculator.targetServer.hostname)
		// noinspection InfiniteLoopJS
		while (true) {
			const now = new Date().getTime()
			const refresh = now > this._lastRefresh + refreshPeriod
			const batchDuration = this._calculator.determineHWGWait()

			if (refresh) { // Refresh bounds
				await this.refreshMaxHackPercentage()
				await this.refreshMaxThreads()
				this.refreshHackPercentage() // TODO this explodes. Calculates a too high percentage
				/*
[2025-05-17 01:39:27] INFO [15]: Calc: H 145 / G 2 / W 6 / T 153 / H% 16.58%
[2025-05-17 01:39:27] INFO [15]:  Acc: H 145 / G 2 / W 6 / T 153 / R 153
[2025-05-17 01:39:27] INFO [15]: Duration 26.279 seconds
[2025-05-17 01:39:53] ----------
[2025-05-17 01:39:53] INFO:  Max: T 154 / H% 30.00%
[2025-05-17 01:39:53] ----------
[2025-05-17 01:39:54] INFO [16]: Calc: H 146 / G 2 / W 6 / T 154 / H% 16.70%
[2025-05-17 01:39:54] INFO [16]:  Acc: H 146 / G 2 / W 6 / T 154 / R 154
[2025-05-17 01:39:54] INFO [16]: Duration 26.279 seconds
[2025-05-17 01:40:20] WARNING [16]: Encountering security drift 1.000 > 1.000
[2025-05-17 01:40:20] ----------
[2025-05-17 01:40:20] WARNING [17]: Forced to renew reservations C 155 ≠ R 154
[2025-05-17 01:40:20] INFO [17]: Calc: H 145 / G 2 / W 6 / T 153 / H% 16.58%
[2025-05-17 01:40:20] INFO [17]:  Acc: H 145 / G 2 / W 6 / T 153 / R 153
[2025-05-17 01:40:20] INFO [17]: Duration 26.279 seconds
[2025-05-17 01:40:46] ----------
[2025-05-17 01:40:46] INFO [18]: Calc: H 145 / G 2 / W 6 / T 153 / H% 16.58%
[2025-05-17 01:40:46] INFO [18]:  Acc: H 145 / G 2 / W 6 / T 153 / R 153
[2025-05-17 01:40:46] INFO [18]: Duration 26.176 seconds
[2025-05-17 01:41:13] ----------
[2025-05-17 01:41:13] INFO:  Max: T 154 / H% 30.00%
[2025-05-17 01:41:13] ----------
[2025-05-17 01:41:13] INFO [19]: Calc: H 146 / G 2 / W 6 / T 154 / H% 16.70%
[2025-05-17 01:41:13] INFO [19]:  Acc: H 146 / G 2 / W 6 / T 154 / R 154
[2025-05-17 01:41:13] INFO [19]: Duration 26.176 seconds
				 */

				this._logger.info()
					.withFormat('Max: T %s / H%% %s')
					.print(this._maxThreads, this._formatter.percentage(this._calculator.maxHackPercentage))
				this._logger.print().print("----------")

				this._lastRefresh = now
			}

			let calculatedThreadsResults = this._calculator.findThreadCounts(this._hackPercentage)
			let calculatedThreadsTotal = calculateTotalThreads(calculatedThreadsResults.threads)
			const calculationReservationMismatch = calculatedThreadsTotal !== this._reservedThreadsTotal

			if (refresh || calculationReservationMismatch) { // Refresh reservations
				if (!refresh && calculationReservationMismatch) {
					this._logger.warn()
						.withIdentifier(this._batch)
						.withFormat('Forced to renew reservations C %s ≠ R %s')
						.print(calculatedThreadsTotal, this._reservedThreadsTotal)
					this.refreshHackPercentage()
					calculatedThreadsResults = this._calculator.findThreadCounts(this._hackPercentage)
					calculatedThreadsTotal = calculateTotalThreads(calculatedThreadsResults.threads)
				}
				await this.reserveThreads(batchDuration, calculatedThreadsResults.threads)
			}

			if (calculatedThreadsResults.totalSecurityIncrease > 100 - this._calculator.targetServer.minDifficulty!) {
				this._logger.warn()
					.withIdentifier(this._batch)
					.withFormat('Hitting max security %s / %s')
					.print(this._formatter.security(calculatedThreadsResults.totalSecurityIncrease),
						this._formatter.security(100 - this._calculator.targetServer.minDifficulty!)
					)
				this._toaster.warn('Hitting max security', this._calculator.targetServer.hostname)
			}

			const startedThreadsWeaken = execReservations(this._ns, this._reservations.weaken, enums.LaunchpadScripts.weaken,
				this._calculator.targetServer.hostname)
			const startedThreadsGrow = execReservations(this._ns, this._reservations.grow, enums.LaunchpadScripts.grow,
				this._calculator.targetServer.hostname)
			const startedThreadsHack = execReservations(this._ns, this._reservations.hack, enums.LaunchpadScripts.hack,
				this._calculator.targetServer.hostname)
			const startedThreadsTotal = startedThreadsWeaken + startedThreadsGrow + startedThreadsHack

			if (startedThreadsTotal !== calculatedThreadsTotal) {
				this._logger.error()
					.withIdentifier(this._batch)
					.withFormat('Started threads do not match calculated total threads %s ≠ %s')
					.print(startedThreadsTotal, calculatedThreadsTotal)
				this._logger.error()
					.withIdentifier(this._batch)
					.withFormat('H S %s C %s R %s / G S %s C %s R %s / W S %s C %s R %s')
					.print(startedThreadsHack, calculatedThreadsResults.threads.hack, calculateTotalTickets(this._reservations.hack),
						startedThreadsGrow, calculatedThreadsResults.threads.grow, calculateTotalTickets(this._reservations.grow),
						startedThreadsWeaken, calculatedThreadsResults.threads.weaken, calculateTotalTickets(this._reservations.weaken))
				this._toaster.error('Started thread mismatch', this._calculator.targetServer.hostname)
			}

			if (startedThreadsTotal !== this._reservedThreadsTotal) {
				this._logger.error()
					.withIdentifier(this._batch)
					.withFormat('Started threads do not match reserved threads %s ≠ %s')
					.print(startedThreadsTotal, this._reservedThreadsTotal)
				this._toaster.error('Reservation mismatch', this._calculator.targetServer.hostname)
			}

			this._logger.info()
				.withIdentifier(this._batch)
				.withFormat('Calc: H %s / G %s / W %s / T %s / H%% %s')
				.print(calculatedThreadsResults.threads.hack, calculatedThreadsResults.threads.grow, calculatedThreadsResults.threads.weaken,
					calculatedThreadsTotal, this._formatter.percentage(this._hackPercentage))
			this._logger.info()
				.withIdentifier(this._batch)
				.withFormat(' Acc: H %s / G %s / W %s / T %s / R %s')
				.print(startedThreadsHack, startedThreadsGrow, startedThreadsWeaken, startedThreadsTotal, this._reservedThreadsTotal)
			this._logger.info()
				.withIdentifier(this._batch)
				.withFormat('Duration %s')
				.print(this._ns.tFormat(batchDuration, true))
			await this._ns.sleep(batchDuration)

			this._calculator.update()

			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			if (this._calculator.targetServer.moneyAvailable! < this._calculator.targetServer.moneyMax! * 0.5) {
				this._logger.warn()
					.withIdentifier(this._batch)
					.withFormat('Encountering heavy money drift %s < %s')
					.print(this._formatter.money(this._calculator.targetServer.moneyAvailable!),
						this._formatter.money(this._calculator.targetServer.moneyMax!))
				this._toaster.warn('Encountering heavy money drift', this._calculator.targetServer.hostname)
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			} else if (this._calculator.targetServer.moneyAvailable! < this._calculator.targetServer.moneyMax! * 0.99) {
				this._logger.warn()
					.withIdentifier(this._batch)
					.withFormat('Encountering money drift %s < %s')
					.print(this._formatter.money(this._calculator.targetServer.moneyAvailable!),
						this._formatter.money(this._calculator.targetServer.moneyMax!))
			}

			if (this._calculator.targetServer.hackDifficulty! > this._calculator.targetServer.baseDifficulty!) {
				this._logger.warn()
					.withIdentifier(this._batch)
					.withFormat('Encountering security drift %s > %s')
					.print(this._formatter.security(this._calculator.targetServer.hackDifficulty!),
						this._formatter.security(this._calculator.targetServer.minDifficulty!))
				this._toaster.warn('Encountering security drift', this._calculator.targetServer.hostname)
			}

			this._batch++
			this._logger.print().print("----------")
		}
	}

	async determineMaxThreads(): Promise<number> {
		const maxAvailableThreads = await this._ramClient.lookupTotalThreads()
		const maxNeededThreads = this._calculator.findThreadCounts()
		return Math.min(maxAvailableThreads, calculateTotalThreads(maxNeededThreads.threads))
	}

	async refreshMaxThreads(): Promise<void> {
		this._maxThreads = await this.determineMaxThreads()
	}

	async refreshMaxHackPercentage(): Promise<void> {
		const bounds = await this._broadcastClient.get()
		this._calculator.maxHackPercentage = bounds.maxHackPercentage
	}

	refreshHackPercentage(): void {
		this._hackPercentage = this._calculator.findHackingPercentage(this._maxThreads)
	}

	async reserveThreads(batchDuration: number, calculatedThreads: HGWThreads): Promise<void> {
		const reservationTime = batchDuration > refreshPeriod ? batchDuration : refreshPeriod + batchDuration // TODO improve less than calculation
		this._reservations = await this._ramClient.reserveThreads({
			name: 'weaken',
			tickets: calculatedThreads.weaken,
			allocationSize: enums.ScriptCost.weaken,
			duration: reservationTime,
			affinity: {
				hostnames: ['home'],
				anti: false,
				hard: this._calculator.homeServer.cpuCores > 1
			}
		}, {
			name: 'grow',
			tickets: calculatedThreads.grow,
			allocationSize: enums.ScriptCost.grow,
			duration: reservationTime,
			affinity: {
				hostnames: ['home'],
				anti: false,
				hard: this._calculator.homeServer.cpuCores > 1
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
	}
}
