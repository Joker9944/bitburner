import {NS} from '@ns'
import {positionalArgument} from '/lib/positionalArgument'

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([])
	const port = positionalArgument(args, 0, 1) as number

	const portHandle = ns.getPortHandle(port)
	ns.tprint(portHandle.full())
	ns.tprint(portHandle.peek())
}
