import {AutocompleteData, NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import {positionalArgument} from '/lib/positionalArgument'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	return [...data.servers];
}

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([])
	const target = positionalArgument(args, 0, 'n00dles') as string

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
