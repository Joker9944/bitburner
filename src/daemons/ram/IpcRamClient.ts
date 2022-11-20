import {NS} from '@ns'
import {ramManagerIdentifier} from "/daemons/ram/RamManagerDaemon";
import {duplex, IpcMessagingClient} from "/lib/ipc/messaging/IpcMessagingClient";
import {Allotments, RamMessageType, ReservationRequest, ReservationsByKey} from "/daemons/ram/RamMessageType";
import {RamManagerEndpoints} from "/daemons/ram/RamManagerEndpoints";
import * as enums from "/lib/enums";

export function createRamClient(ns: NS, identifier: string): IpcRamClient {
	const client = duplex<RamMessageType>(ns, ramManagerIdentifier, identifier, enums.PortIndex.ramMessagingServerIn, enums.PortIndex.ramMessagingClientIn)
	return new IpcRamClient(client)
}

export class IpcRamClient {
	private readonly _client: IpcMessagingClient<RamMessageType>

	constructor(client: IpcMessagingClient<RamMessageType>) {
		this._client = client
	}

	async reserveThreads(...reservations: ReservationRequest[]): Promise<ReservationsByKey> {
		await this._client.get(RamManagerEndpoints.releaseReservation) // TODO this creates a race condition

		const response = await this._client.post(RamManagerEndpoints.requestReservation, reservations)
		const data = response.messageData as ReservationsByKey

		if (Object.entries(data).length !== 0) {
			return data
		} else {
			throw new Error('Reservation got rejected')
		}
	}

	async releaseReservations(): Promise<void> {
		await this._client.get(RamManagerEndpoints.releaseReservation)
	}

	async lookupThreads(): Promise<Allotments> {
		const response = await this._client.get(RamManagerEndpoints.lookupFreeRamByAllotments, enums.ScriptCost.weaken)

		const data = response.messageData as Allotments
		const entries = Object.entries(data).map((entry) => [entry[0], this.mapRamToThreads(entry[1])])

		return Object.fromEntries(entries)
	}

	async lookupTotalThreads(): Promise<number> {
		const data = await this.lookupThreads()
		const values = Object.values(data)
		if (values.length === 0) {
			return 0
		}
		return Object.values(data).reduce((a, b) => a + b)
	}

	async lookupReservations(): Promise<ReservationsByKey> {
		const response = await this._client.get(RamManagerEndpoints.lookupReservations)
		return response.messageData as ReservationsByKey
	}

	mapRamToThreads(ram: number): number {
		return Math.floor(ram / enums.ScriptCost.weaken)
	}
}
