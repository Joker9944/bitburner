import {NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	const processes = ns.ps(execServerHostname)
		.filter((process) => process.filename === enums.BatcherScripts.batcher || process.filename === enums.Commands.shack || process.filename === enums.Commands.fluffer)
		.flatMap((process) => process.args)
	getNetNodes(ns).filter((node) => node.server.hasAdminRights)
		.filter((node) => node.server.moneyMax !== 0)
		.filter((node) => node.server.serverGrowth > 1)
		.filter((node) => !processes.includes(node.server.hostname))
		.forEach((node) => {
			ns.exec(enums.Commands.shack, execServerHostname, 1, node.server.hostname)
		})
}
