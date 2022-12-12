import {AutocompleteData, NS} from '@ns'
import {cncDaemonIdentifier} from '/daemons/cnc/CnCBroadcasterDaemon'
import {CnCEndpoints} from '/daemons/cnc/CnCEndpoints'
import {Bounds} from '/daemons/cnc/Bounds'
import {simplex} from '/lib/ipc/messaging/IpcMessagingClient'
import {ArgsSchema} from '/lib/ArgsSchema'
import * as enums from '/lib/enums'

export const cncCommandIdentifier = 'command-cnc'

const argsSchema = [
	[enums.CommonArgs.maxHackPercentage, -1],
	[enums.CommonArgs.maxThreads, -1],
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return []
}

export async function main(ns: NS): Promise<void> {
	const args = ns.flags(argsSchema)
	const maxHackPercentage = args[enums.CommonArgs.maxHackPercentage] as number
	const maxThreads = args[enums.CommonArgs.maxThreads] as number

	const messagingClient = simplex<Bounds>(ns, cncDaemonIdentifier, cncCommandIdentifier, enums.PortIndex.cncMessaging)

	const data = (await messagingClient.get(CnCEndpoints.get)).messageData as Bounds

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
