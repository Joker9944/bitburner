import { NS } from '@ns'
import { getNetNodes, getNetNode } from 'lib/NetNode'
import * as enums from 'lib/enums'

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([['home', false]])

	let ramUsed = 0
	let ramTotal = 0
	if (args['home']) {
		const homeNode = getNetNode(ns, 'home')
		ramUsed = homeNode.server.ramUsed
		ramTotal = homeNode.server.maxRam
	} else {
		getNetNodes(ns)
			.filter((node) => node.server.hasAdminRights)
			.forEach((node) => {
				ramUsed += node.server.ramUsed
				ramTotal += node.server.maxRam
			})
	}
	ns.tprintf(
		'%s (%s/%s)',
		ns.nFormat(ramUsed / ramTotal, enums.Format.percentage),
		ns.nFormat(ramUsed * 1000000000, enums.Format.ram),
		ns.nFormat(ramTotal * 1000000000, enums.Format.ram)
	)
}
