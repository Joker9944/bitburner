import {NS, Player, Server} from '@ns'
import * as enums from 'lib/enums'

export function findBatcherThreadCounts(
	ns: NS,
	percentage: number,
	growThreadsSuggestion: number,
	player: Player,
	target: Server,
	cores: number
): HGWThreads {
	const mockServer = populateMockServer(target, ns.formulas.mockServer())

	// hack
	const moneyPerHackThread = ns.hackAnalyze(target.hostname)
	const hackThreads = Math.ceil(percentage / moneyPerHackThread)
	const hackSecurityIncrease = hackThreads * enums.Security.hackIncrease
	mockServer.hackDifficulty += hackSecurityIncrease
	mockServer.moneyAvailable -= target.moneyMax * moneyPerHackThread * hackThreads

	// grow
	const targetPercentage = target.moneyMax / mockServer.moneyAvailable
	const growThreads = findGrowThreadCount(ns, targetPercentage, growThreadsSuggestion, player, mockServer, cores)
	const growSecurityIncrease = growThreads * enums.Security.growIncrease

	// weaken
	const securityDrift = target.hackDifficulty - target.minDifficulty
	const totalSecurityIncrease = hackSecurityIncrease + growSecurityIncrease
	const weakenSecurityDecrease = ns.weakenAnalyze(1, cores)
	const weakenThreads = Math.ceil((totalSecurityIncrease + securityDrift) / weakenSecurityDecrease)
	return new HGWThreads(hackThreads, growThreads, weakenThreads, totalSecurityIncrease)
}

export class HGWThreads {
	hack: number
	grow: number
	weaken: number
	totalSecurityIncrease: number

	constructor(hack: number, grow: number, weaken: number, totalSecurityIncrease: number) {
		this.hack = hack
		this.grow = grow
		this.weaken = weaken
		this.totalSecurityIncrease = totalSecurityIncrease
	}

	total(): number {
		return this.hack + this.grow + this.weaken
	}
}

function populateMockServer(original: Server, mock: Server): Server {
	mock.moneyMax = original.moneyMax
	mock.moneyAvailable = original.moneyAvailable
	mock.serverGrowth = original.serverGrowth
	mock.baseDifficulty = original.baseDifficulty
	mock.minDifficulty = original.minDifficulty
	mock.hackDifficulty = original.hackDifficulty
	return mock
}

function findGrowThreadCount(
	ns: NS,
	targetPercentage: number,
	growThreadsSuggestion: number,
	player: Player,
	server: Server,
	cores: number
): number {
	// one thread is more than needed
	if (ns.formulas.hacking.growPercent(server, 1, player, cores) > targetPercentage) {
		return 1
	}

	const high = searchHigh(ns, targetPercentage, growThreadsSuggestion - 50, 100, player, server, cores)
	const low = searchLow(ns, targetPercentage, high, 100, player, server, cores)
	return searchHigh(ns, targetPercentage, low, 1, player, server, cores)
}

function searchHigh(
	ns: NS,
	targetPercentage: number,
	threads: number,
	increase: number,
	player: Player,
	server: Server,
	cores: number
): number {
	const percent = ns.formulas.hacking.growPercent(server, threads, player, cores)
	if (percent > targetPercentage) {
		return threads
	} else {
		return searchHigh(ns, targetPercentage, threads + increase, increase, player, server, cores)
	}
}

function searchLow(
	ns: NS,
	targetPercentage: number,
	threads: number,
	decrease: number,
	player: Player,
	server: Server,
	cores: number
): number {
	const percent = ns.formulas.hacking.growPercent(server, threads, player, cores)
	if (percent < targetPercentage) {
		return threads
	} else {
		return searchLow(ns, targetPercentage, threads - decrease, decrease, player, server, cores)
	}
}
