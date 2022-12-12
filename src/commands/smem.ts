import {AutocompleteData, NS} from '@ns'
import {getNetNodes, getNetNode} from 'lib/NetNode'
import {ArgsSchema} from '/lib/ArgsSchema'
import * as enums from 'lib/enums'

enum Args {
	home = 'home',
}

const argsSchema = [
	[Args.home, false],
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return [];
}

export async function main(ns: NS): Promise<void> {
	const args = ns.flags(argsSchema)

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
