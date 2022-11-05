import { NS } from '@ns'
import { getNetNodes } from 'lib/NetNode'

export function calculateMaxThreadCount(ns: NS, threadRamCost: number, free = true): Record<string, number> {
	const netNodes = getNetNodes(ns).filter((node) => node.server.hasAdminRights)

	const threadsMap: Record<string, number> = {}
	netNodes.forEach((node) => {
		const freeRam = free ? node.freeRamMB() : node.maxRamMB()

		if (freeRam <= 0) {
			return
		}
		const threads = Math.floor(freeRam / threadRamCost)
		if (threads > 0) {
			threadsMap[node.server.hostname] = threads
		}
	})
	return threadsMap
}
