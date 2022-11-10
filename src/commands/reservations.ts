import {NS} from '@ns'
import {Logger, LogType} from '/lib/logging/Logger'
import {createRamClient} from '/daemons/ram/IpcRamClient'
import * as enums from "/lib/enums";

const identifier = 'command-threads'

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	const client = createRamClient(ns, identifier)
	const data = await client.lookupReservations()

	const dataEntries = Object.entries(data)

	if (dataEntries.length === 0) {
		logger.print(LogType.terminal, 'Nothing reserved')
		return
	}

	logger.print(LogType.terminal, '~~~~~~~~~~ Beginning reservations ~~~~~~~~~~')
	logger.print(LogType.terminal, ' ')
	dataEntries.forEach(entry => {
		if (entry[1].length === 0) {
			return
		}
		logger.print(LogType.terminal, '%s', entry[0])
		logger.print(LogType.terminal, '------')
		entry[1].forEach(reservation => {
			if (reservation.timeout === undefined) {
				logger.print(LogType.terminal, '%s -> %s / ram: %s, allocation: %s',
					reservation.owner, reservation.name,
					ns.nFormat(reservation.ramMB * 1000000, enums.Format.ram),
					ns.nFormat(reservation.allocationSize * 1000000, enums.Format.ram))
			} else {
				const timeout = new Date(reservation.timeout)
				logger.print(LogType.terminal, '%s -> %s / ram: %s, allocation: %s, timeout: %s',
					reservation.owner, reservation.name,
					ns.nFormat(reservation.ramMB * 1000000, enums.Format.ram),
					ns.nFormat(reservation.allocationSize * 1000000, enums.Format.ram),
					timeout.toLocaleString('sv'))
			}
		})
		logger.print(LogType.terminal, ' ')
	})
}
