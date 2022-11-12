export type RamMessageType = Allotments | ReservationRequest[] | ReservationsByKey | string | number

export type Allotments = {
	[hostname: string]: Allocation
}

export type Allocation = number

export type ReservationRequest = {
	name: string
	tickets: number
	allocationSize: number
	affinity?: Affinity
	duration?: number
}

export type Affinity = {
	anti: boolean
	hard: boolean
	hostnames: string[]
}

export type ReservationsByKey = {
	[key: string]: Reservation[]
}

export type Reservation = {
	owner: string
	name: string
	hostname: string
	ramMB: number
	allocationSize: number
	affinity?: Affinity
	timeout?: number
}

export function calculateTickets(reservation: Reservation): number {
	return Math.floor(reservation.ramMB / reservation.allocationSize)
}

export function calculateTotalTickets(reservations: Reservation[]): number {
	return reservations.map(reservation => calculateTickets(reservation))
		.reduce((a, b) => a + b)
}
