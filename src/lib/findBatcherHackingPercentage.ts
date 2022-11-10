import {NS, Player, Server} from '@ns'
import {findBatcherThreadCounts, HGWThreads} from 'lib/findBatcherThreadCounts'

export function findBatcherHackingPercentage(ns: NS, targetThreadCount: number, percentageSuggestion: number, maxPercentage: number,
                                             growThreadsSuggestion: number, player: Player, target: Server, cores: number): number {
	const max = findBatcherThreadCounts(ns, maxPercentage, growThreadsSuggestion, player, target, cores)
	if (max.total() <= targetThreadCount) {
		return maxPercentage
	}

	const startHigh = Math.min(percentageSuggestion + 0.1, maxPercentage)
	const searchImprecise = 0.01
	const searchPrecise = 0.001

	const low = searchLow(ns, targetThreadCount, startHigh, searchImprecise, growThreadsSuggestion, player, target, cores)
	const high = searchHigh(ns, targetThreadCount, low.percentage, searchImprecise, low.threads.grow, player, target, cores)
	const result = searchLow(ns, targetThreadCount, high.percentage, searchPrecise, high.threads.grow, player, target, cores).percentage
	return fixed(result)
}

function fixed(percent: number, decimalPlace = 2): number {
	return +percent.toFixed(decimalPlace)
}

class Result {
	threads: HGWThreads
	percentage: number

	constructor(threads: HGWThreads, percentage: number) {
		this.threads = threads
		this.percentage = percentage
	}
}

function searchHigh(ns: NS, targetThreadCount: number, percentage: number, increase: number, growThreadsSuggestion: number,
                    player: Player, target: Server, cores: number): Result {
	const threads = findBatcherThreadCounts(ns, percentage, growThreadsSuggestion, player, target, cores)
	if (threads.total() >= targetThreadCount) {
		return new Result(threads, percentage)
	} else {
		return searchHigh(ns, targetThreadCount, percentage + increase, increase, threads.grow, player, target, cores)
	}
}

function searchLow(ns: NS, targetThreadCount: number, percentage: number, decrease: number, growThreadsSuggestion: number,
                   player: Player, target: Server, cores: number): Result {
	const threads = findBatcherThreadCounts(ns, percentage, growThreadsSuggestion, player, target, cores)
	if (threads.total() <= targetThreadCount) {
		return new Result(threads, percentage)
	} else {
		return searchLow(ns, targetThreadCount, percentage - decrease, decrease, threads.grow, player, target, cores)
	}
}
