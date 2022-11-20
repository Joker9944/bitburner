import {NS, ScriptArg} from "@ns";

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([])
	const port = ((args['_'] as ScriptArg[]).length === 0 ? 1 : (args['_'] as ScriptArg[])[0]) as number

	const portHandle = ns.getPortHandle(port)
	ns.tprint(portHandle.full())
	ns.tprint(portHandle.peek())
}
