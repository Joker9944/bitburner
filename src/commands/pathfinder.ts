import { NS } from '@ns'
import { getNetNodes } from '/lib/NetNode'

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([])
	const target = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]

	const origin = ns.getHostname()
	const netNodes = getNetNodes(ns)
	const targetNode = netNodes.find((node) => node.server.hostname === target)
	if (targetNode !== undefined) {
		ns.tprintf(
			targetNode
				.searchPathUp(origin)
				.map((node) => node.server.hostname)
				.join(' -> ')
		)
	} else {
		ns.tprintf('Could not find %s', target)
	}
}
