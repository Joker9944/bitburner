import {NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	const args = ns.ps(execServerHostname)
		.filter((process) => process.filename === enums.BatcherScripts.batcher || process.filename === enums.Commands.shack || process.filename === enums.Commands.fluffer)
		.flatMap((process) => process.args)
	const shackableServers = getNetNodes(ns).filter((node) => node.server.hasAdminRights)
		.filter((node) => node.server.moneyMax !== 0)
		.filter((node) => node.server.serverGrowth > 1)
		.filter((node) => !args.includes(node.server.hostname))
	for (const node of shackableServers) {
		ns.exec(enums.Commands.shack, execServerHostname, 1, node.server.hostname)
		await ns.sleep(400)
	}
}
