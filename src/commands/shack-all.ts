import {NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

const batcherScripts = Object.values(enums.BatcherScripts) as string[]

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	const runningBatcherArgs = ns.ps(execServerHostname)
		.filter(process => batcherScripts.includes(process.filename))
		.flatMap(process => process.args)
	const shackableServers = getNetNodes(ns).filter((node) => node.server.hasAdminRights)
		.filter((node) => node.server.moneyMax !== 0)
		.filter((node) => node.server.serverGrowth !== undefined && node.server.serverGrowth > 1)
		.filter((node) => !runningBatcherArgs.includes(node.server.hostname))
	for (const node of shackableServers) {
		ns.exec(enums.BatcherScripts.h4cker, execServerHostname, 1, node.server.hostname)
		await ns.sleep(400)
	}
}
