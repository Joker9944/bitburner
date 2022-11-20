import {NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {createRamClient} from '/daemons/ram/IpcRamClient'
import * as enums from '/lib/enums';

const identifier = 'command-threads'

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	const client = createRamClient(ns, identifier)
	const data = await client.lookupReservations()

	const dataEntries = Object.entries(data)

	if (dataEntries.length === 0) {
		logger.print()
			.terminal()
			.print('Nothing reserved')
		return
	}

	logger.print()
		.terminal()
		.print('~~~~~~~~~~ Beginning reservations ~~~~~~~~~~')
	logger.print()
		.terminal()
		.print(' ')
	dataEntries.forEach(entry => {
		if (entry[1].length === 0) {
			return
		}
		logger.print()
			.terminal()
			.withFormat('%s')
			.print(entry[0])
		logger.print()
			.terminal()
			.print('------')
		entry[1].forEach(reservation => {
			if (reservation.timeout === undefined) {
				logger.print()
					.terminal()
					.withFormat('%s -> %s / ram: %s, allocation: %s')
					.print(reservation.owner, reservation.name,
						ns.nFormat(reservation.ramMB * 1000000, enums.Format.ram),
						ns.nFormat(reservation.allocationSize * 1000000, enums.Format.ram))
			} else {
				const timeout = new Date(reservation.timeout)
				logger.print()
					.terminal()
					.withFormat('%s -> %s / ram: %s, allocation: %s, timeout: %s')
					.print(reservation.owner, reservation.name,
						ns.nFormat(reservation.ramMB * 1000000, enums.Format.ram),
						ns.nFormat(reservation.allocationSize * 1000000, enums.Format.ram),
						timeout.toLocaleString('sv'))
			}
		})
		logger.print()
			.terminal()
			.print(' ')
	})
}
