import {NS} from '@ns'
import {calculateTickets, Reservation} from "/daemons/ram/RamMessageType";

export function execReservations(ns: NS, reservations: Reservation[], script: string, ...args: (string | number | boolean)[]): number {
	let startedThreads = 0
	for (const reservation of reservations) {
		const tickets = calculateTickets(reservation)
		const pid = ns.exec(script, reservation.hostname, tickets, ...args)
		if (pid !== 0) {
			startedThreads += tickets
		}
	}

	return startedThreads
}
