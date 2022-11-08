import {NS} from '@ns'
import {cncDaemonIdentifier} from "/daemons/cnc/CnCBroadcasterDaemon";
import {CnCEndpoints} from "/daemons/cnc/CnCEndpoints";
import {Bounds} from "/daemons/cnc/Bounds";
import {simplex} from '/lib/ipc/messaging/IpcMessagingClient'
import * as enums from "/lib/enums";

export const cncCommandIdentifier = 'command-cnc'

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([
		['max-hack-percentage', -1],
		['max-threads', -1]
	])
	const maxHackPercentage = args['max-hack-percentage'] as number
	const maxThreads = args['max-threads'] as number

	const messagingClient = simplex<Bounds>(ns, cncDaemonIdentifier, cncCommandIdentifier, enums.PortIndex.cncMessaging)

	const data = (await messagingClient.get(CnCEndpoints.get)).messageData as Bounds

	ns.tprintf('~~~~~~~~~~ Beginning cnc ~~~~~~~~~~')
	if (maxHackPercentage !== -1 || maxThreads !== -1) {
		ns.tprintf('Old: %s', JSON.stringify(data))

		if (maxHackPercentage !== -1) {
			data.maxHackPercentage = maxHackPercentage
		}
		if (maxThreads !== -1) {
			data.maxThreads = maxThreads
		}

		ns.tprintf('New: %s', JSON.stringify(data))
		await messagingClient.post(CnCEndpoints.set, data)
	} else {
		ns.tprintf('%s', JSON.stringify(data))
	}
}
