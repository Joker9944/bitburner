import { NS } from '@ns'
import { getNetNodes } from 'lib/NetNode'

export function executeScript(
	ns: NS,
	script: string,
	threads: number,
	reservedRam: Record<string, number> = {},
	...args: string[]
): number {
	const cost = ns.getScriptRam(script) * 1000
	const netNodes = getNetNodes(ns).filter((node) => node.server.hasAdminRights)

	let startedThreads = 0
	for (let i = 0; startedThreads < threads && i < netNodes.length; i++) {
		const node = netNodes[i]

		let freeRam = node.freeRamMB()
		if (reservedRam[node.server.hostname] !== undefined) {
			const reserveLimit = node.maxRamMB() - reservedRam[node.server.hostname]
			if (freeRam > reserveLimit) {
				freeRam = reserveLimit
			}
		}

		if (freeRam <= 0) {
			continue
		}

		let availableThreads = Math.floor(freeRam / cost)
		if (availableThreads <= 0) {
			continue
		}

		if (availableThreads > threads - startedThreads) {
			availableThreads = threads - startedThreads
		}

		ns.exec(script, node.server.hostname, availableThreads, ...args)
		startedThreads += availableThreads
	}

	return startedThreads
}
