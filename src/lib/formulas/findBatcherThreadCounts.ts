import {NS, Player, Server} from '@ns'
import {mockServer} from '/lib/mockServer';
import * as enums from '/lib/enums'

export function findBatcherThreadCounts(ns: NS, hackPercentage: number,
										player: Player, targetServer: Server, cores: number): ResultSetThreads {
	const targetServerPrediction = mockServer(targetServer)

	// hack
	const moneyPercentagePerHackThread = ns.hackAnalyze(targetServer.hostname)
	if (moneyPercentagePerHackThread === 0) {
		throw new Error('Server ' + targetServer.hostname + ' is not hackable')
	}
	const hackThreads = Math.ceil(hackPercentage / moneyPercentagePerHackThread)
	const hackSecurityIncrease = hackThreads * enums.Security.hackIncrease
	targetServerPrediction.hackDifficulty! += hackSecurityIncrease
	targetServerPrediction.moneyAvailable! -= targetServer.moneyMax! * moneyPercentagePerHackThread * hackThreads

	// grow
	const growThreads = ns.formulas.hacking.growThreads(targetServerPrediction, player, targetServer.moneyMax!, cores)
	const growSecurityIncrease = growThreads * enums.Security.growIncrease

	// weaken
	const securityDrift = targetServer.hackDifficulty! - targetServer.minDifficulty!
	const totalSecurityIncrease = hackSecurityIncrease + growSecurityIncrease
	const totalSecurityOffset = securityDrift + totalSecurityIncrease
	const weakenSecurityDecreaseByThread = ns.weakenAnalyze(1, cores)
	const weakenThreads = Math.ceil(totalSecurityOffset / weakenSecurityDecreaseByThread)

	return {
		totalSecurityIncrease: totalSecurityIncrease,
		threads: {
			hackThreadCount: hackThreads,
			growThreadCount: growThreads,
			weakenThreadCount: weakenThreads,
		}
	}
}

export type ResultSetThreads = {
	threads: HGWThreads
	totalSecurityIncrease: number
}

export type HGWThreads = {
	hackThreadCount: number
	growThreadCount: number
	weakenThreadCount: number
}

export function calculateTotalThreads(threads: HGWThreads): number {
	return threads.hackThreadCount + threads.growThreadCount + threads.weakenThreadCount
}
