import {NS} from '@ns'
import {ramManagerIdentifier} from "/daemons/ram/RamManagerDaemon";
import {simplex, IpcMessagingClient} from "/lib/ipc/messaging/IpcMessagingClient";
import {Allotments, RamMessageType, RamReservation} from "/daemons/ram/RamMessageType";
import {RamManagerEndpoints} from "/daemons/ram/RamManagerEndpoints";
import * as enums from "/lib/enums";

export function createRamClient(ns: NS, identifier: string): IpcRamClient {
	const client = simplex<RamMessageType>(ns, ramManagerIdentifier, identifier, enums.PortIndex.ramMessaging)
	return new IpcRamClient(client)
}

export class IpcRamClient {
	private readonly _client: IpcMessagingClient<RamMessageType>

	constructor(client: IpcMessagingClient<RamMessageType>) {
		this._client = client
	}

	async reserveThreads(threads: number, time: number): Promise<Allotments> {
		await this._client.get(RamManagerEndpoints.releaseReservation)

		const response = await this._client.post(RamManagerEndpoints.requestReservation, {
			requestedRam: threads * enums.ScriptCost.launchpadScripts,
			allocationSize: enums.ScriptCost.launchpadScripts,
			time: time
		} as RamReservation)

		const data = response.messageData as Allotments
		const entries = Object.entries(data).map((entry) => [entry[0], this.mapRamToThreads(entry[1])])

		if (entries.length !== 0) {
			return Object.fromEntries(entries)
		} else {
			throw new Error('Reservation got rejected')
		}
	}

	async releaseReservations(): Promise<void> {
		await this._client.get(RamManagerEndpoints.releaseReservation)
	}

	async lookupThreads(): Promise<Allotments> {
		const response = await this._client.post(RamManagerEndpoints.lookupFreeRamByAllotments, {
			allocationSize: enums.ScriptCost.launchpadScripts,
		})

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

	mapRamToThreads(ram: number): number {
		return Math.floor(ram / enums.ScriptCost.launchpadScripts)
	}
}
