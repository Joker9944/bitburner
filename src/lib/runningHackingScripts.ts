import {NS} from '@ns'
import {Logger} from 'lib/logging/Logger'
import {getNetNodes} from 'lib/NetNode'
import * as enums from 'lib/enums'

const launchpadScripts = Object.values(enums.LaunchpadScripts) as string[]

/**
 * Waits for all hacking scripts targeting a server to finnish.
 *
 * @param {NS} ns
 * @param {String} targetHostname
 */
export async function runningHackingScripts(ns: NS, targetHostname: string): Promise<void> {
	const logger = new Logger(ns)

	const processesByHostname = getNetNodes(ns).map(node => {
		const processes = ns.ps(node.server.hostname)
			.filter(process => process.args.includes(targetHostname))
			.filter(process => launchpadScripts.includes(process.filename))
		return {
			hostname: node.server.hostname,
			processes: processes,
		}
	}).filter(entry => entry.processes.length > 0)

	if (processesByHostname.length > 0) {
		logger.info()
			.print('Waiting for running hacking scripts to conclude')
	}

	for (const entry of processesByHostname) {
		for (const process of entry.processes) {
			while (ns.isRunning(process.pid, entry.hostname)) {
				await ns.sleep(1000)
			}
		}
	}
}
