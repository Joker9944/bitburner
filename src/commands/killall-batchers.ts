import {NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

const batcherScripts = Object.values(enums.BatcherScripts) as string[]

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	const processes = getNetNodes(ns, execServerHostname).flatMap(node => ns.ps(node.hostname)
		.filter(process => batcherScripts.includes(process.filename)))
	processes.forEach(process => ns.kill(process.pid))
}
