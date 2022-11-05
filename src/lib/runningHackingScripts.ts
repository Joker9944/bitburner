import { NS } from '@ns'
import { Logger, LogType } from 'lib/logging/Logger'
import * as enums from 'lib/enums'

/**
 * Waits for all hacking scripts targeting a server to finnish.
 *
 * @param {NS} ns
 * @param {String} execServerHostname
 * @param {String} targetServerHostname
 */
export async function runningHackingScripts(
	ns: NS,
	execHostname: string,
	targetHostname: string
): Promise<void> {
	const logger = new Logger(ns)

	const runningScripts = ns
		.ps(execHostname)
		.filter((script) => script.args.includes(targetHostname))
		.filter((script) => {
			return (
				script.filename === enums.LaunchpadScripts.hack ||
				script.filename === enums.LaunchpadScripts.grow ||
				script.filename === enums.LaunchpadScripts.weaken
			)
		})
	if (runningScripts.length > 0) {
		logger.info(
			LogType.log,
			'Waiting for running hacking scripts to conclude'
		)
	}
	for (let i = 0; i < runningScripts.length; i++) {
		while (ns.isRunning(runningScripts[i].pid)) {
			await ns.sleep(1000)
		}
	}
}
