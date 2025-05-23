import {NS, ProcessInfo} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {duplex, IpcMessagingServer, RequestHandler} from "/lib/ipc/messaging/IpcMessagingServer";
import {Allotments, RamMessageType, Reservation, ReservationRequest, ReservationsByKey} from "/daemons/ram/RamMessageType";
import {RamManagerEndpoints} from "/daemons/ram/RamManagerEndpoints";
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

export const ramManagerIdentifier = 'daemon-ram-manager'
const continuousReservationsOwner = ramManagerIdentifier + '-continuous'
const hardReservationsOwner = ramManagerIdentifier + '-hard'
const timeoutBuffer = 2000

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	await new RamManagerDaemon(ns).main()
}

class RamManagerDaemon {
	private readonly _ns: NS
	private readonly _logger: Logger
	private readonly _server: IpcMessagingServer<RamMessageType>

	private readonly _ramTable: Record<string, number> = {}
	private readonly _reservationTable: Record<string, Reservation[]> = {}

	constructor(ns: NS) {
		this._ns = ns

		this._logger = new Logger(ns)
		this._server = duplex(ns, ramManagerIdentifier, enums.PortIndex.ramMessagingClientIn, enums.PortIndex.ramMessagingServerIn)

		this._reservationTable.home = []
		this._reservationTable.home.push({
			owner: hardReservationsOwner,
			name: 'player',
			hostname: 'home',
			ramMB: 20000,
			allocationSize: 20000,
		})
	}

	async main(): Promise<void> {
		// noinspection InfiniteLoopJS
		while (true) {
			const handler = await this._server.listen()
			this.updateRamTable()
			this.updateContinuousReservations()
			this.releaseTimedOutReservations()
			await this.handle(handler)
		}
	}

	async handle(handler: RequestHandler<RamMessageType>): Promise<void> {
		switch (handler.request.endpoint) {
			case RamManagerEndpoints.requestReservation: {
				const data = handler.request.messageData
				if (data === undefined) {
					this._logger.error()
						.withIdentifier(handler.request.messageId)
						.print('Ram reservation request without data')
				}
				this.releaseReservations(handler.request.requester)
				this._logger.info()
					.withIdentifier(handler.request.messageId)
					.print('Reserving ram')
				const reservationRequests = data as ReservationRequest[]
				const reservations = {} as ReservationsByKey
				reservationRequests.forEach(request => {
					const allotments = this.calculateRamAllocations(request)
					const allotmentEntries = Object.entries(allotments)
					if (allotmentEntries.length > 0) {
						reservations[request.name] = []
					}
					allotmentEntries.forEach(entry => {
						const reservation = this.createReservation(handler.request.requester, entry[0], entry[1], request)
						reservations[request.name].push(reservation)
					})
				})
				if (Object.entries(reservations).length > 0) {
					await handler.respond(reservations)
				} else {
					this._logger.warn()
						.withIdentifier(handler.request.messageId)
						.print('Rejecting reservation')
					await handler.respond({})
				}
				break
			}
			case RamManagerEndpoints.releaseReservation: {
				this._logger.info()
					.withIdentifier(handler.request.messageId)
					.print('Releasing all reservations')
				this.releaseReservations(handler.request.requester)
				await handler.respond('OK')
				break
			}
			case RamManagerEndpoints.lookupReservations: {
				this._logger.info()
					.withIdentifier(handler.request.messageId)
					.print('Looking up reservations')
				await handler.respond(this._reservationTable)
				break
			}
			case RamManagerEndpoints.lookupFreeRamByAllotments: {
				const data = handler.request.messageData
				if (data === undefined) {
					this._logger.error()
						.withIdentifier(handler.request.messageId)
						.print('Lookup request without data')
				}
				this._logger.info()
					.withIdentifier(handler.request.messageId)
					.print('Looking up free ram by allocation')
				const allocationSize = data as number
				const ramAllocation = this.calculateTotalUnreservedRam(allocationSize, handler.request.requester)
				await handler.respond(ramAllocation)
				break
			}
			default: {
				this._logger.error()
					.withIdentifier(handler.request.messageId)
					.withFormat('Manager does not handle %s endpoints')
					.print(handler.request.endpoint)
				await handler.respond('NOK')
				break
			}
		}
	}

	updateRamTable(): void {
		getNetNodes(this._ns)
			.map(node => this._ns.getServer(node.hostname))
			.filter(server => server.hasAdminRights)
			.forEach(server => this._ramTable[server.hostname] = server.maxRam * 1000)
	}

	updateContinuousReservations(): void {
		this.releaseReservations(continuousReservationsOwner)
		const processesByHost = Object.keys(this._ramTable).map((hostname) => {
			const processes = this._ns.ps(hostname).filter(process => process.filename.startsWith('daemons/') || process.filename.startsWith('bin/'))
			return {
				hostname: hostname,
				processes: processes,
			}
		})
		processesByHost.forEach(byHostEntry => {
			const processByFilename = Array.from(this.groupByFilename(byHostEntry.processes))
			processByFilename.forEach(byFilenameEntry => {
				const cost = this._ns.getScriptRam(byFilenameEntry.filename, byHostEntry.hostname) * 1000
				this.createReservation(continuousReservationsOwner, byHostEntry.hostname, cost * byFilenameEntry.processes.length, {
					name: byFilenameEntry.filename,
					allocationSize: cost,
					tickets: byFilenameEntry.processes.length,
				})
			})
		})
	}

	* groupByFilename(list: ProcessInfo[]) {
		const groups = new Map<string, ProcessInfo[]>();
		for (const item of list) {
			const group = groups.get(item.filename) ?? []
			group.push(item)
			groups.set(item.filename, group)
		}
		for (const [filename, processes] of groups) {
			yield {filename, processes}
		}
	}

	calculateRamAllocations(request: ReservationRequest): Allotments {
		const requestedRam = request.allocationSize * request.tickets
		let ramTableKeys = Object.keys(this._ramTable)

		if (request.affinity !== undefined) {
			if (request.affinity.hard && request.affinity.anti) {
				ramTableKeys = ramTableKeys.filter(hostname => !request.affinity?.hostnames.includes(hostname))
			} else if (request.affinity.hard && !request.affinity.anti) {
				ramTableKeys = ramTableKeys.filter(hostname => request.affinity?.hostnames.includes(hostname))
			} else if (!request.affinity.hard && request.affinity.anti) {
				ramTableKeys = ramTableKeys.sort((a, b) => {
					if (request.affinity?.hostnames.includes(a) && request.affinity?.hostnames.includes(b)) {
						return 0
					} else if (request.affinity?.hostnames.includes(a)) {
						return 1
					} else if (request.affinity?.hostnames.includes(b)) {
						return -1
					} else {
						return 0
					}
				})
			} else if (!request.affinity.hard && !request.affinity.anti) {
				ramTableKeys = ramTableKeys.sort((a, b) => {
					if (request.affinity?.hostnames.includes(a) && request.affinity?.hostnames.includes(b)) {
						return 0
					} else if (request.affinity?.hostnames.includes(a)) {
						return -1
					} else if (request.affinity?.hostnames.includes(b)) {
						return 1
					} else {
						return 0
					}
				})
			}
		}

		const ramPerServer: Allotments = {}
		let totalRam = 0
		for (let i = 0; i < ramTableKeys.length && totalRam < requestedRam; i++) {
			const hostname = ramTableKeys[i]

			const freeRam = this.calculateUnreservedRam(hostname)
			if (freeRam <= 0) {
				continue
			}

			let availableAllotments = Math.floor(freeRam / request.allocationSize)
			if (availableAllotments <= 0) {
				continue
			}

			if (availableAllotments * request.allocationSize > requestedRam - totalRam) {
				availableAllotments = Math.floor((requestedRam - totalRam) / request.allocationSize)
			}

			const allotment = availableAllotments * request.allocationSize
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

	createReservation(owner: string, hostname: string, ramMB: number, request: ReservationRequest): Reservation {
		if (this._reservationTable[hostname] === undefined) {
			this._reservationTable[hostname] = []
		}

		const reservation: Reservation = {
			owner: owner,
			name: request.name,
			hostname: hostname,
			ramMB: ramMB,
			allocationSize: request.allocationSize
		}

		if (request.affinity !== undefined) {
			reservation.affinity = request.affinity
		}

		if (request.duration !== undefined) {
			reservation.timeout = new Date().getTime() + request.duration + timeoutBuffer
		}

		this._reservationTable[hostname].push(reservation)
		return reservation
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
