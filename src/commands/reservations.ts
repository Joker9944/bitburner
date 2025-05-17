import {NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {createRamClient} from '/daemons/ram/IpcRamClient'
import {Formatter} from "/lib/logging/Formatter";

const identifier = 'command-threads'

export async function main(ns: NS): Promise<void> {
	const formatter = new Formatter(ns)
	const logger = new Logger(ns)

	const client = createRamClient(ns, identifier)
	const data = await client.lookupReservations()

	const dataEntries = Object.entries(data)

	if (dataEntries.length === 0) {
		logger.logEntry()
			.terminal()
			.print('Nothing reserved')
		return
	}

	logger.logEntry()
		.terminal()
		.print('~~~~~~~~~~ Beginning reservations ~~~~~~~~~~')
	logger.logEntry()
		.terminal()
		.print(' ')
	dataEntries.forEach(entry => {
		if (entry[1].length === 0) {
			return
		}
		logger.logEntry()
			.terminal()
			.withFormat('%s')
			.print(entry[0])
		logger.logEntry()
			.terminal()
			.print('------')
		entry[1].forEach(reservation => {
			if (reservation.timeout === undefined) {
				logger.logEntry()
					.terminal()
					.withFormat('%s -> %s / ram: %s, allocation: %s')
					.print(reservation.owner, reservation.name,
						formatter.ram(reservation.ramMB / 1000),
						formatter.ram(reservation.allocationSize / 1000)
					)
			} else {
				const timeout = new Date(reservation.timeout)
				logger.logEntry()
					.terminal()
					.withFormat('%s -> %s / ram: %s, allocation: %s, timeout: %s')
					.print(reservation.owner, reservation.name,
						formatter.ram(reservation.ramMB / 1000),
						formatter.ram(reservation.allocationSize / 1000),
						timeout.toLocaleString('sv'))
			}
		})
		logger.logEntry()
			.terminal()
			.print(' ')
	})
}
