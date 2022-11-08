import {getNetNode} from "/lib/NetNode";
import {executeScript} from 'lib/executeScript'
import * as enums from 'lib/enums'

// TODO port this
export async function main(ns: NS): Promise<void> {
	ns.disableLog('scan');
	ns.disableLog('getServerUsedRam');
	ns.disableLog('exec');
	ns.disableLog('getServerMoneyAvailable');
	ns.disableLog('getServerSecurityLevel');
	ns.disableLog('sleep');

	const args = ns.flags([
		['thread-limit', 1000000]
	])
	const growThreads = args['thread-limit'] as number * 0.9
	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'foodnstuff' : (args['_'] as string[])[0]
	const targetNode = getNetNode(ns, targetServerHostname)

	const execServerHostname = ns.getHostname()

	let batch = 0;
	// noinspection InfiniteLoopJS
	while (true) {
		const execNode = getNetNode(ns, execServerHostname)
		const securityDecrease = ns.weakenAnalyze(1, execNode.server.cpuCores);

		const securityIncrease = growThreads * enums.Security.growIncrease;
		const weakenThreads = Math.ceil(securityIncrease / securityDecrease);

		let startedThreads = executeScript(ns, enums.LaunchpadScripts.weaken, weakenThreads, enums.reservedRam, targetNode.server.hostname);
		startedThreads += executeScript(ns, enums.LaunchpadScripts.grow, growThreads, enums.reservedRam, targetNode.server.hostname);
		const requestedThreads = growThreads + weakenThreads;
		if (startedThreads < requestedThreads) {
			ns.printf('WARNING: Requested %s threads but only started %s', requestedThreads, startedThreads);
			ns.toast('Failed to schedule threads', ns.enums.toast.WARNING, 10);
		}

		const wait = ns.getWeakenTime(targetNode.server.hostname) + 500
		await ns.sleep(wait);

		ns.printf('INFO [%s]: Grow threads: %s, Total threads: %s, Duration: %s', batch++, growThreads, startedThreads, ns.tFormat(wait));
	}
}
