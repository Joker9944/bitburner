import {NS, ScriptArg} from '@ns'
import * as enums from '/lib/enums'

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([])
	const port = ((args[enums.CommonArgs.positional] as ScriptArg[]).length === 0 ? 1 : (args[enums.CommonArgs.positional] as ScriptArg[])[0]) as number

	const portHandle = ns.getPortHandle(port)
	ns.tprint(portHandle.full())
	ns.tprint(portHandle.peek())
}
