import {NS} from '@ns'
import {IdentifierLogger, LogType} from '/lib/logging/Logger'
import {IpcMessagingServer, RequestHandler, simplex} from "/lib/ipc/messaging/IpcMessagingServer";
import {Allotments, RamMessageType, RamReservation} from "/daemons/ram/RamMessageType";
import {RamManagerEndpoints} from "/daemons/ram/RamManagerEndpoints";
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

export const ramManagerIdentifier = 'daemon-ram-manager'

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	await new RamManagerDaemon(ns).main()
}

// TODO implement preferred hosts
class RamManagerDaemon {
	private readonly _ns: NS
	private readonly _logger: IdentifierLogger
	private readonly _server: IpcMessagingServer<RamMessageType>

	private readonly _ramTable: Record<string, number> = {}
	private readonly _reservationTable: Record<string, Reservation[]> = {}

	constructor(ns: NS) {
		this._ns = ns

		this._logger = new IdentifierLogger(ns)
		this._server = simplex(ns, ramManagerIdentifier, enums.PortIndex.ramMessaging)

		this.updateRamTable()
		this._reservationTable.home = []
		this._reservationTable.home.push({
			owner: 'hard-reservation',
			ramMB: 30000
		} as Reservation)
	}

	async main(): Promise<void> {
		// noinspection InfiniteLoopJS
		while (true) {
			const handler = await this._server.listen()
			this.updateRamTable()
			this.releaseTimedOutReservations()
			await this.handle(handler)
		}
	}

	async handle(handler: RequestHandler<Allotments | RamReservation | string>): Promise<void> {
		switch (handler.request.endpoint) {
			case RamManagerEndpoints.requestReservation: {
				this._logger.info(LogType.log, handler.request.messageId, 'Reserving ram')
				const data = handler.request.messageData as RamReservation
				const ramAllocation = this.calculateRamAllocation(data.requestedRam, data.allocationSize)
				const ramAllocationEntries = Object.entries(ramAllocation)
				if (ramAllocationEntries.length > 0) {
					ramAllocationEntries.forEach((entry) => this.createReservation(entry[0], handler.request.requester, entry[1], data.time))
					await handler.respond(ramAllocation)
				} else {
					this._logger.warn(LogType.log, handler.request.messageId, 'Rejecting reservation')
					await handler.respond({})
				}
				break
			}
			case RamManagerEndpoints.releaseReservation: {
				this._logger.info(LogType.log, handler.request.messageId, 'Releasing all reservations')
				this.releaseReservations(handler.request.requester)
				await handler.respond('OK')
				break
			}
			case RamManagerEndpoints.lookupFreeRamByAllotments: {
				this._logger.info(LogType.log, handler.request.messageId, 'Looking up free ram')
				const data = handler.request.messageData as RamReservation
				const ramAllocation = this.calculateTotalUnreservedRam(data['allocationSize'], handler.request.requester)
				await handler.respond(ramAllocation)
				break
			}
			default: {
				this._logger.error(LogType.log, handler.request.messageId, 'Manager does not handle %s endpoints', handler.request.endpoint)
				await handler.respond('NOK')
				break
			}
		}
	}

	updateRamTable(): void {
		getNetNodes(this._ns).filter(node => node.server.hasAdminRights)
			.forEach(node => this._ramTable[node.server.hostname] = node.maxRamMB())
	}

	calculateRamAllocation(requestedRam: number, allocationSize: number, ignoredReservationOwner?: string): Allotments {
		const ramTableKeys = Object.keys(this._ramTable)

		const ramPerServer: Allotments = {}
		let totalRam = 0
		for (let i = 0; i < ramTableKeys.length && totalRam < requestedRam; i++) {
			const hostname = ramTableKeys[i]

			const freeRam = this.calculateUnreservedRam(hostname, ignoredReservationOwner)
			if (freeRam <= 0) {
				continue
			}

			let availableAllotments = Math.floor(freeRam / allocationSize)
			if (availableAllotments <= 0) {
				continue
			}

			if (availableAllotments * allocationSize > requestedRam - totalRam) {
				availableAllotments = Math.floor((requestedRam - totalRam) / allocationSize)
			}

			const allotment = availableAllotments * allocationSize
			ramPerServer[hostname] = allotment
			totalRam += allotment
		}

		return ramPerServer
	}

	calculateTotalUnreservedRam(allocationSize: number, ignoredReservationOwner?: string): Allotments {
		const ramTableKeys = Object.keys(this._ramTable)

		const ramPerServer: Allotments = {}
		for (let i = 0; i < ramTableKeys.length; i++) {
			const hostname = ramTableKeys[i]

			const freeRam = this.calculateUnreservedRam(hostname, ignoredReservationOwner)

			const availableAllotments = Math.floor(freeRam / allocationSize)
			if (availableAllotments <= 0) {
				continue
			}

			ramPerServer[hostname] = availableAllotments * allocationSize
		}

		return ramPerServer
	}

	calculateReservedRam(hostname: string, ignoredReservationOwner?: string): number {
		if (this._reservationTable[hostname] === undefined) {
			return 0
		}
		let reservations = this._reservationTable[hostname]
		if (ignoredReservationOwner !== undefined) {
			reservations = reservations.filter((reservation) => reservation.owner !== ignoredReservationOwner)
		}
		if (reservations.length === 0) {
			return 0
		}
		return reservations.map((reservation) => reservation.ramMB).reduce((a, b) => a + b)
	}

	calculateUnreservedRam(hostname: string, ignoredReservationOwner?: string): number {
		return this._ramTable[hostname] - this.calculateReservedRam(hostname, ignoredReservationOwner)
	}

	createReservation(hostname: string, owner: string, ramMB: number, time?: number): void {
		if (this._reservationTable[hostname] === undefined) {
			this._reservationTable[hostname] = []
		}

		const reservation: Reservation = {
			owner: owner,
			ramMB: ramMB,
		}

		if (time !== undefined) {
			reservation.timeout = new Date().getTime() + time
		}

		this._reservationTable[hostname].push(reservation)
	}

	releaseReservations(owner: string): void {
		Object.entries(this._reservationTable).forEach((entry) => {
			this._reservationTable[entry[0]] = entry[1].filter((reservation) => reservation.owner !== owner)
		})
	}

	releaseTimedOutReservations(): void {
		const now = new Date().getTime()
		Object.entries(this._reservationTable).forEach((entry) => {
			this._reservationTable[entry[0]] = entry[1].filter(reservation => {
				if (reservation.timeout === undefined) {
					return true
				}
				return now < reservation.timeout
			})
		})
	}
}

type Reservation = {
	owner: string
	ramMB: number
	timeout?: number
}
