import { NS } from '@ns'
import * as enums from 'lib/enums'

const daemonServerName = 'daemon-host'
const daemonScript = Object.values(enums.DaemonScripts)

export async function main(ns: NS): Promise<void> {
	const ramCost = Math.ceil(daemonScript.map((script) => ns.getScriptRam(script)).reduce((a, b) => a + b))
	if (!ns.serverExists(daemonServerName)) {
		ns.purchaseServer(daemonServerName, findNextPower(ramCost))
	} else if (ns.getServerMaxRam(daemonServerName) < ramCost) {
		ns.deleteServer(daemonServerName)
		ns.purchaseServer(daemonServerName, findNextPower(ramCost))
	}

	ns.scp(daemonScript, daemonServerName, 'home')

	daemonScript.forEach((script) => ns.exec(script, daemonServerName, 1))
}

function findNextPower(n: number, base = 2) {
	let exp = 0
	let result = 0
	do {
		result = Math.pow(base, exp++)
	} while (result < n)
	return result
}
