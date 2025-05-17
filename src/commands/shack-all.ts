import {NS} from '@ns'
import {getNetNodes} from '/lib/NetNode'
import * as enums from '/lib/enums'

const batcherScripts = Object.values(enums.BatcherScripts) as string[]

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	const runningBatcherArgs = ns.ps(execServerHostname)
		.filter(process => batcherScripts.includes(process.filename))
		.flatMap(process => process.args)
	const shackableServers = getNetNodes(ns)
		.map(node => ns.getServer(node.hostname))
		.filter(server => server.hasAdminRights)
		.filter(server => server.moneyMax !== 0)
		.filter(server => server.serverGrowth !== undefined && server.serverGrowth > 1)
		.filter(server => !runningBatcherArgs.includes(server.hostname))
	for (const server of shackableServers) {
		ns.exec(enums.BatcherScripts.h4cker, execServerHostname, 1, server.hostname)
		await ns.sleep(400)
	}
}
