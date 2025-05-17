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
	const targetHostname = positionalArgument(args, 0, 'n00dles') as string

	// You can connect to home from everywhere
	if (targetHostname === 'home') {
		ns.singularity.connect('home')
		return
	}

	const origin = ns.getHostname()
	const netNodes = getNetNodes(ns)
	const targetNode = netNodes.find((node) => node.hostname === targetHostname)
	if (targetNode !== undefined) {
		targetNode.searchPathUp(origin).forEach(node => ns.singularity.connect(node.hostname))
	} else {
		new Logger(ns).error().terminal().withFormat('Could not find %s').print(targetHostname)
	}
}
