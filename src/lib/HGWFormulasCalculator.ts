import {NS, Player, Server} from '@ns'
import {findBatcherHackingPercentage} from '/lib/formulas/findBatcherHackingPercentage'
import {calculateTotalThreads, findBatcherThreadCounts, ResultSetThreads} from '/lib/formulas/findBatcherThreadCounts'

export class HGWFormulasCalculator {
	private readonly _ns: NS

	// Used to speedup consecutive searches since we know a number that was close on last calculation
	private _hackPercentageSuggestion: number
	private _growThreadsSuggestion: number

	// The maximum amount we want to hack
	private _maxHackPercentage: number

	// Caching to reduce calculations
	private _player: Player
	private _homeServer: Server
	private _targetServer: Server
	private readonly _resultCache: Map<number, ResultSetThreads> = new Map()
	private _maxMoneyGain?: number
	private _expGain?: number
	private _hgwWait?: number

	constructor(ns: NS, targetServer: Server,
				maxHackPercentage: number, hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this._hackPercentageSuggestion = hackPercentageSuggestion
		this._growThreadsSuggestion = growThreadsSuggestion

		this._maxHackPercentage = maxHackPercentage

		this._player = ns.getPlayer()
		this._homeServer = ns.getServer("home")
		this._targetServer = targetServer
	}

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
			this._player,
			this._targetServer,
			this._homeServer.cpuCores
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
			this._player,
			this._targetServer,
			this._homeServer.cpuCores
		)
		this._hackPercentageSuggestion = hackPercentage
		this._growThreadsSuggestion = result.threads.grow
		this._resultCache.set(hackPercentage, result)
		return result
	}

	calculateTUPS(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads) / (this.determineHWGWait() / 1000)
	}

	calculateTotalThreads(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads)
	}

	calculateMoneyGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const moneyPerThread = this._ns.hackAnalyze(this._targetServer.hostname) * this._targetServer.moneyMax!
			return this.findThreadCounts(hackPercentage).threads.hack * moneyPerThread
		}
		if (this._maxMoneyGain === undefined) {
			const moneyPerThread = this._ns.hackAnalyze(this._targetServer.hostname) * this._targetServer.moneyMax!
			this._maxMoneyGain = this.findThreadCounts().threads.hack * moneyPerThread
		}
		return this._maxMoneyGain
	}

	calculateMoneyPerSecond(hackPercentage?: number): number {
		return this.calculateMoneyGain(hackPercentage) / (this.determineHWGWait() / 1000)
	}

	calculateExpGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this._targetServer, this._player)
			return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads) * expPerThread
		}
		if (this._expGain === undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this._targetServer, this._player)
			this._expGain = calculateTotalThreads(this.findThreadCounts().threads) * expPerThread
		}
		return this._expGain
	}

	// TODO this cannot be right - The total amount of threads needs to be taken into account
	calculateExpPerSecond(hackPercentage?: number): number {
		return this.calculateExpGain(hackPercentage) / (this.determineHWGWait() / 1000)
	}

	determineHWGWait(): number {
		if (this._hgwWait === undefined) {
			this._hgwWait = [
				this._ns.formulas.hacking.hackTime(this._targetServer, this._player),
				this._ns.formulas.hacking.growTime(this._targetServer, this._player),
				this._ns.formulas.hacking.weakenTime(this._targetServer, this._player),
			].reduce((a, b) => Math.max(a, b)) + 200
		}
		return this._hgwWait
	}

	public get player() {
		return this._player
	}

	public get homeServer() {
		return this._homeServer
	}

	public get targetServer() {
		return this._targetServer
	}

	update(): void {
		this._player = this._ns.getPlayer()
		this._homeServer = this._ns.getServer("home")
		this._targetServer = this._ns.getServer(this._targetServer.hostname)
		this._reset()
	}

	private _reset(): void {
		this._resultCache.clear()
		this._maxMoneyGain = undefined
		this._expGain = undefined
		this._hgwWait = undefined
	}
}
