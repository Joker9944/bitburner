import {NS, Player} from '@ns'
import {NetNode} from 'lib/NetNode'
import {findBatcherHackingPercentage} from 'lib/findBatcherHackingPercentage'
import {calculateTotalThreads, findBatcherThreadCounts, HGWThreads} from 'lib/findBatcherThreadCounts'
import {getNetNode} from '/lib/NetNode'

export class HGWFormulasCalculator {
	homeNode: NetNode
	targetNode: NetNode
	player: Player
	private readonly _ns: NS
	private _hackPercentageSuggestion: number
	private _growThreadsSuggestion: number
	private _maxThreadCounts?: HGWThreads
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
		if (targetThreadCount !== undefined) {
			const percentage = findBatcherHackingPercentage(
				this._ns,
				targetThreadCount,
				this._hackPercentageSuggestion,
				this._maxHackPercentage,
				this._growThreadsSuggestion,
				this.player,
				this.targetNode.server,
				this.homeNode.server.cpuCores
			)
			this._hackPercentageSuggestion = percentage
			return percentage
		}
		return this._maxHackPercentage
	}

	findThreadCounts(hackPercentage?: number): HGWThreads {
		if (hackPercentage !== undefined) {
			const threads = findBatcherThreadCounts(
				this._ns,
				hackPercentage,
				this._growThreadsSuggestion,
				this.player,
				this.targetNode.server,
				this.homeNode.server.cpuCores
			)
			this._growThreadsSuggestion = threads.grow
			return threads
		}
		if (this._maxThreadCounts === undefined) {
			this._maxThreadCounts = this.findThreadCounts(this._maxHackPercentage)
		}
		return this._maxThreadCounts
	}

	calculateTUPS(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage)) / (this.determineHWGWait() / 1000)
	}

	calculateMoneyGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const moneyPerThread = this._ns.hackAnalyze(this.targetNode.server.hostname) * this.targetNode.server.moneyMax
			return this.findThreadCounts(hackPercentage).hack * moneyPerThread
		}
		if (this._maxMoneyGain === undefined) {
			const moneyPerThread = this._ns.hackAnalyze(this.targetNode.server.hostname) * this.targetNode.server.moneyMax
			this._maxMoneyGain = this.findThreadCounts().hack * moneyPerThread
		}
		return this._maxMoneyGain
	}

	calculateMPS(hackPercentage?: number): number {
		return this.calculateMoneyGain(hackPercentage) / (this.determineHWGWait() / 1000)
	}

	calculateExpGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this.targetNode.server, this.player)
			return calculateTotalThreads(this.findThreadCounts(hackPercentage)) * expPerThread
		}
		if (this._maxExpGain === undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this.targetNode.server, this.player)
			this._maxExpGain = calculateTotalThreads(this.findThreadCounts()) * expPerThread
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
		this._reset()
	}

	private _reset(): void {
		this._maxThreadCounts = undefined
		this._maxMoneyGain = undefined
		this._maxExpGain = undefined
		this._hgwWait = undefined
	}
}
