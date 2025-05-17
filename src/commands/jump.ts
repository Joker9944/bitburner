import {AutocompleteData, NS} from "@ns";
import {getNetNodes} from "/lib/NetNode";
import {positionalArgument} from "/lib/positionalArgument";
import {Logger} from "/lib/logging/Logger";

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
		targetNode.searchPathUp(origin).forEach(node => ns.singularity.connect(node.server.hostname))
	} else {
		new Logger(ns).error().terminal().withFormat('Could not find %s').print(target)
	}
}
