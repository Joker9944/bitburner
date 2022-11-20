import {NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	const processes = getNetNodes(ns, execServerHostname).flatMap(node => {
		return ns.ps(node.server.hostname).filter(process => process.filename === enums.BatcherScripts.batcher)
	})
	processes.forEach(process => {
		ns.kill(process.pid)
	})
}
