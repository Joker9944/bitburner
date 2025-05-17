import {NS, Player, Server} from '@ns'
import {calculateTotalThreads, findBatcherThreadCounts, ResultSetThreads} from '/lib/formulas/findBatcherThreadCounts'

export function findBatcherHackingPercentage(ns: NS, targetThreadCount: number, percentageSuggestion: number,
                                             growThreadsSuggestion: number, player: Player, target: Server, cores: number): ResultSetHackingPercentage {
	const searchImprecise = 0.01
	const searchPrecise = 0.0001

	const low = searchLow(ns, targetThreadCount, percentageSuggestion, searchImprecise, growThreadsSuggestion, player, target, cores)
	const high = searchHigh(ns, targetThreadCount, low.percentage, searchImprecise, low.threadResult.threads.grow, player, target, cores)
	const result = searchLow(ns, targetThreadCount, high.percentage, searchPrecise, high.threadResult.threads.grow, player, target, cores)
	result.percentage = floor(result.percentage, 4)
	return result
}

function floor(n: number, decimalPlace = 2): number {
	const multiplier = Math.pow(10, decimalPlace)
	return Math.floor(n * multiplier) / multiplier
}

type ResultSetHackingPercentage = {
	percentage: number
	threadResult: ResultSetThreads
}

function searchHigh(ns: NS, targetThreadCount: number, percentage: number, increase: number, growThreadsSuggestion: number,
                    player: Player, target: Server, cores: number): ResultSetHackingPercentage {
	const result = findBatcherThreadCounts(ns, percentage, growThreadsSuggestion, player, target, cores)
	if (calculateTotalThreads(result.threads) >= targetThreadCount) {
		return {percentage: percentage, threadResult: result}
	} else {
		return searchHigh(ns, targetThreadCount, percentage + increase, increase, result.threads.grow, player, target, cores)
	}
}

function searchLow(ns: NS, targetThreadCount: number, percentage: number, decrease: number, growThreadsSuggestion: number,
                   player: Player, target: Server, cores: number): ResultSetHackingPercentage {
	const result = findBatcherThreadCounts(ns, percentage, growThreadsSuggestion, player, target, cores)
	if (calculateTotalThreads(result.threads) <= targetThreadCount) {
		return {percentage: percentage, threadResult: result}
	} else {
		return searchLow(ns, targetThreadCount, percentage - decrease, decrease, result.threads.grow, player, target, cores)
	}
}
