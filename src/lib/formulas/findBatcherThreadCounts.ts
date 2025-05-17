import {NS, Player, Server} from '@ns'
import {mockServer} from '/lib/mockServer';
import * as enums from '/lib/enums'

export function findBatcherThreadCounts(ns: NS, percentage: number, growThreadsSuggestion: number,
                                        player: Player, target: Server, cores: number): ResultSetThreads {
	const mockedServer = mockServer(target)

	// hack
	const moneyPercentagePerHackThread = ns.hackAnalyze(target.hostname)
	if (moneyPercentagePerHackThread === 0) {
		throw new Error('Server ' + target.hostname + ' is not hackable')
	}
	const hackThreads = Math.ceil(percentage / moneyPercentagePerHackThread) // TODO maybe change to Math.floor
	const hackSecurityIncrease = hackThreads * enums.Security.hackIncrease
	mockedServer.hackDifficulty! += hackSecurityIncrease
	mockedServer.moneyAvailable! -= target.moneyMax! * moneyPercentagePerHackThread * hackThreads

	// grow
	const targetPercentage = target.moneyMax! / mockedServer.moneyAvailable!
	const growThreads = findGrowThreadCount(ns, targetPercentage, growThreadsSuggestion, player, mockedServer, cores)
	const growSecurityIncrease = growThreads * enums.Security.growIncrease

	// weaken
	const securityDrift = target.hackDifficulty! - target.minDifficulty!
	const totalSecurityIncrease = hackSecurityIncrease + growSecurityIncrease
	const weakenSecurityDecrease = ns.weakenAnalyze(1, cores)
	const weakenThreads = Math.ceil((totalSecurityIncrease + securityDrift) / weakenSecurityDecrease)
	return {
		totalSecurityIncrease: totalSecurityIncrease,
		threads: {
			hack: hackThreads,
			grow: growThreads,
			weaken: weakenThreads,
		}
	}
}

export type ResultSetThreads = {
	threads: HGWThreads
	totalSecurityIncrease: number
}

export type HGWThreads = {
	hack: number
	grow: number
	weaken: number
}

export function calculateTotalThreads(threads: HGWThreads): number {
	return threads.hack + threads.grow + threads.weaken
}

function findGrowThreadCount(ns: NS, targetPercentage: number, growThreadsSuggestion: number,
                             player: Player, server: Server, cores: number): number {
	// one thread is more than needed
	if (ns.formulas.hacking.growPercent(server, 1, player, cores) > targetPercentage) {
		return 1
	}

	const startLow = growThreadsSuggestion - 50
	const searchImprecise = 100
	const searchPrecise = 1

	const high = searchHigh(ns, targetPercentage, startLow, searchImprecise, player, server, cores)
	const low = searchLow(ns, targetPercentage, high, searchImprecise, player, server, cores)
	return searchHigh(ns, targetPercentage, low, searchPrecise, player, server, cores)
}

function searchHigh(ns: NS, targetPercentage: number, threads: number, increase: number,
                    player: Player, server: Server, cores: number): number {
	const percent = ns.formulas.hacking.growPercent(server, threads, player, cores)
	if (percent > targetPercentage) {
		return threads
	} else {
		return searchHigh(ns, targetPercentage, threads + increase, increase, player, server, cores)
	}
}

function searchLow(ns: NS, targetPercentage: number, threads: number, decrease: number,
                   player: Player, server: Server, cores: number): number {
	const percent = ns.formulas.hacking.growPercent(server, threads, player, cores)
	if (percent < targetPercentage) {
		return threads
	} else {
		return searchLow(ns, targetPercentage, threads - decrease, decrease, player, server, cores)
	}
}
