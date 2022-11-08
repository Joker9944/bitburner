export type RamMessageType = Allotments | RamReservation | string

export type Allotments = {
	[key: string]: number
}

export type RamReservation = {
	requestedRam: number
	allocationSize: number
	time: number
}
