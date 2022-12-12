import {NS, Player} from '@ns'
import {NetNode} from 'lib/NetNode'
import {findBatcherHackingPercentage} from '/lib/formulas/findBatcherHackingPercentage'
import {calculateTotalThreads, findBatcherThreadCounts, ResultSetThreads} from '/lib/formulas/findBatcherThreadCounts'
import {getNetNode} from '/lib/NetNode'

export class HGWFormulasCalculator {
	homeNode: NetNode
	targetNode: NetNode
	player: Player
	private readonly _ns: NS
	private _hackPercentageSuggestion: number
	private _growThreadsSuggestion: number
	private readonly _resultCache: Map<number, ResultSetThreads> = new Map()
	private _maxMoneyGain?: number
	private _maxExpGain?: number
	private _hgwWait?: number

	constructor(ns: NS, targetServerNode: NetNode,
	            maxHackPercentage: number, hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this.homeNode = getNetNode(ns, 'home')
		this.targetNode = targetServerNode

		this.player = ns.getPlayer()

		this._maxHackPercentage = maxHackPercentage

		this._hackPercentageSuggestion = hackPercentageSuggestion
		this._growThreadsSuggestion = growThreadsSuggestion
	}

	private _maxHackPercentage: number

	get maxHackPercentage(): number {
		return this._maxHackPercentage
	}

	set maxHackPercentage(maxHackPercentage: number) {
		this._maxHackPercentage = maxHackPercentage
		this._reset()
	}

	findHackingPercentage(targetThreadCount?: number): number {
		if (targetThreadCount === undefined) {
			return this._maxHackPercentage
		}
		const cachedEntry = Array.from(this._resultCache.entries())
			.find(entry => calculateTotalThreads(entry[1].threads) === targetThreadCount)
		if (cachedEntry !== undefined) {
			return cachedEntry[0]
		}
		const result = findBatcherHackingPercentage(
			this._ns,
			targetThreadCount,
			this._hackPercentageSuggestion,
			this._maxHackPercentage,
			this._growThreadsSuggestion,
			this.player,
			this.targetNode.server,
			this.homeNode.server.cpuCores
		)
		this._hackPercentageSuggestion = result.percentage
		this._growThreadsSuggestion = result.threadResult.threads.grow
		this._resultCache.set(result.percentage, result.threadResult)
		return result.percentage
	}

	findThreadCounts(hackPercentage?: number): ResultSetThreads {
		if (hackPercentage === undefined) {
			hackPercentage = this._maxHackPercentage
		}
		const cachedEntry = this._resultCache.get(hackPercentage)
		if (cachedEntry !== undefined) {
			return cachedEntry
		}
		const result = findBatcherThreadCounts(
			this._ns,
			hackPercentage,
			this._growThreadsSuggestion,
			this.player,
			this.targetNode.server,
			this.homeNode.server.cpuCores
		)
		this._hackPercentageSuggestion = hackPercentage
		this._growThreadsSuggestion = result.threads.grow
		this._resultCache.set(hackPercentage, result)
		return result
	}

	calculateTUPS(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads) / (this.determineHWGWait() / 1000)
	}

	calculateTU(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads)
	}

	calculateMoneyGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const moneyPerThread = this._ns.hackAnalyze(this.targetNode.server.hostname) * this.targetNode.server.moneyMax
			return this.findThreadCounts(hackPercentage).threads.hack * moneyPerThread
		}
		if (this._maxMoneyGain === undefined) {
			const moneyPerThread = this._ns.hackAnalyze(this.targetNode.server.hostname) * this.targetNode.server.moneyMax
			this._maxMoneyGain = this.findThreadCounts().threads.hack * moneyPerThread
		}
		return this._maxMoneyGain
	}

	calculateMPS(hackPercentage?: number): number {
		return this.calculateMoneyGain(hackPercentage) / (this.determineHWGWait() / 1000)
	}

	calculateExpGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this.targetNode.server, this.player)
			return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads) * expPerThread
		}
		if (this._maxExpGain === undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this.targetNode.server, this.player)
			this._maxExpGain = calculateTotalThreads(this.findThreadCounts().threads) * expPerThread
		}
		return this._maxExpGain
	}

	calculateEPS(hackPercentage?: number): number {
		return this.calculateExpGain(hackPercentage) / (this.determineHWGWait() / 1000)
	}

	determineHWGWait(): number {
		if (this._hgwWait === undefined) {
			this._hgwWait = [
				this._ns.formulas.hacking.hackTime(this.targetNode.server, this.player),
				this._ns.formulas.hacking.growTime(this.targetNode.server, this.player),
				this._ns.formulas.hacking.weakenTime(this.targetNode.server, this.player),
			].reduce((a, b) => Math.max(a, b)) + 200
		}
		return this._hgwWait
	}

	ownsAdditionalCores(): boolean {
		return this.homeNode.server.cpuCores > 1
	}

	refresh(): void {
		this.homeNode.refresh()
		this.targetNode.refresh()
		this.player = this._ns.getPlayer()
		this._reset()
	}

	private _reset(): void {
		this._resultCache.clear()
		this._maxMoneyGain = undefined
		this._maxExpGain = undefined
		this._hgwWait = undefined
	}
}
