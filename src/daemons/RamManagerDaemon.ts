import { NS } from '@ns'
import { Logger, LogType } from 'lib/logging/Logger'
import { Envelop, IpcClient } from 'lib/ipc/IpcClient'
import { getNetNodes } from 'lib/NetNode'
import * as enums from 'lib/enums'

export const ramManagerIdentifier = 'ram-manager-daemon'

export async function main(ns: NS): Promise<void> {
	await new Manager(ns).loop()
}

class Manager {
	ns: NS
	logger: Logger
	client: IpcClient<RamManagerMessage>

	ramTable: Record<string, number> = {}
	reservationTable: Record<string, Reservation[]> = {}

	constructor(ns: NS) {
		this.ns = ns

		ns.disableLog('ALL')
		this.logger = new Logger(ns)
		this.client = new IpcClient<RamManagerMessage>(ns, ramManagerIdentifier, enums.PortIndex.ramManager)
		this.client.clear()

		getNetNodes(ns).forEach((node) => (this.ramTable[node.server.hostname] = node.maxRamMB()))
		this.reservationTable['home'] = []
		this.reservationTable['home'].push(new Reservation('hard-reservation', 30000))
	}

	async loop(): Promise<void> {
		while (true) {
			const envelope = await this.client.receive()
			await this.handle(envelope)
		}
	}

	async handle(envelope: Envelop<RamManagerMessage>): Promise<void> {
		switch (envelope.payload.command) {
			case RamManagerCommand.requestReservation: {
				const data = envelope.payload.data as Record<string, number>
				this.logger.info(LogType.terminal, JSON.stringify(data))
				const ramAllocation = this.calculateRamAllocation(data['requestedRam'], data['allocationSize'])
				const ramAllocationEntries = Object.entries(ramAllocation)
				this.logger.info(LogType.terminal, JSON.stringify(ramAllocation))
				if (ramAllocationEntries.length > 0) {
					this.logger.info(LogType.log, 'Reserving ram for %s', envelope.author)
					ramAllocationEntries.forEach((entry) => this.createReservation(entry[0], envelope.author, entry[1]))
					await this.client.send(
						envelope.author,
						new RamManagerMessage(RamManagerCommand.grantReservation, ramAllocation)
					)
				} else {
					this.logger.warn(LogType.log, 'Rejecting reservation for %s', envelope.author)
					await this.client.send(envelope.author, new RamManagerMessage(RamManagerCommand.rejectReservation))
				}
				break
			}
			case RamManagerCommand.releaseReservation: {
				this.logger.info(LogType.log, 'Releasing all reservations for %s', envelope.author)
				this.releaseReservations(envelope.author)
				break
			}
			case RamManagerCommand.lookupFreeRamByAllotments: {
				this.logger.info(LogType.log, 'Looking up free ram for %s', envelope.author)
				const data = envelope.payload.data as Record<string, number>
				const ramAllocation = this.calculateTotalUnreservedRam(data['allocationSize'], envelope.author)
				await this.client.send(
					envelope.author,
					new RamManagerMessage(RamManagerCommand.lookupFreeRamByAllotments, ramAllocation)
				)
				break
			}
			default: {
				this.logger.error(LogType.log, 'Manager does not handle %s command', envelope.payload.command)
				break
			}
		}
	}

	calculateRamAllocation(
		requestedRam: number,
		allocationSize: number,
		ignoredReservationOwner?: string
	): Record<string, number> {
		const ramTableKeys = Object.keys(this.ramTable)

		const ramPerServer: Record<string, number> = {}
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

	calculateTotalUnreservedRam(allocationSize: number, ignoredReservationOwner?: string): Record<string, number> {
		const ramTableKeys = Object.keys(this.ramTable)

		const ramPerServer: Record<string, number> = {}
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
		if (this.reservationTable[hostname] !== undefined) {
			let reservations = this.reservationTable[hostname]
			if (ignoredReservationOwner !== undefined) {
				reservations = reservations.filter((reservation) => reservation.owner !== ignoredReservationOwner)
			}
			return reservations.map((reservation) => reservation.ramMB).reduce((a, b) => a + b)
		} else {
			return 0
		}
	}

	calculateUnreservedRam(hostname: string, ignoredReservationOwner?: string): number {
		return this.ramTable[hostname] - this.calculateReservedRam(hostname, ignoredReservationOwner)
	}

	createReservation(hostname: string, owner: string, ramMB: number): void {
		if (this.reservationTable[hostname] === undefined) {
			this.reservationTable[hostname] = [new Reservation(owner, ramMB)]
		} else {
			this.reservationTable[hostname].push(new Reservation(owner, ramMB))
		}
	}

	releaseReservations(owner: string): void {
		const reservationTableEntries = Object.entries(this.reservationTable)
		reservationTableEntries.forEach((entry) => {
			const reservations = entry[1].filter((reservation) => reservation.owner !== owner)
			this.reservationTable[entry[0]] = reservations
		})
	}
}

export class RamManagerMessage {
	command: RamManagerCommand
	data: unknown

	constructor(command: RamManagerCommand, data?: unknown) {
		this.command = command
		this.data = data
	}
}

export enum RamManagerCommand {
	requestReservation,
	grantReservation,
	rejectReservation,
	releaseReservation,
	lookupFreeRamByAllotments,
}

class Reservation {
	owner: string
	ramMB: number

	constructor(owner: string, ramMB: number) {
		this.owner = owner
		this.ramMB = ramMB
	}
}
