import {AutocompleteData, NS} from '@ns'
import {getNetNodes, getNetNode} from 'lib/NetNode'
import {ArgsSchema} from '/lib/ArgsSchema'
import {Formatter} from "/lib/logging/Formatter";
import {Logger} from "/lib/logging/Logger";

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

	const formatter = new Formatter(ns)
	const logger = new Logger(ns)

	let ramUsed = 0
	let ramTotal = 0
	// TODO List print
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
	logger.logEntry()
		.terminal()
		.withFormat('%s (%s/%s)')
		.print(
			formatter.percentage(ramUsed / ramTotal),
			formatter.ram(ramUsed),
			formatter.ram(ramTotal),
		)
}
