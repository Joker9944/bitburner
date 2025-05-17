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
	private _maxHackExpGain?: number
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

	// Main calculator functions

	findHackingPercentage(targetThreadCount?: number): number {
		if (targetThreadCount === undefined) {
			return this._maxHackPercentage
		}
		const cachedResult = Array.from(this._resultCache.entries())
			.find(entry => calculateTotalThreads(entry[1].threads) === targetThreadCount)
		if (cachedResult !== undefined) {
			return cachedResult[0]
		}
		// We tage the cached suggestion or the max, whichever is smaller
		const percentageSuggestion = Math.min(this._hackPercentageSuggestion + 0.1, this._maxHackPercentage)
		// We do not have a cached result for this thread count
		const result = findBatcherHackingPercentage(
			this._ns,
			targetThreadCount,
			percentageSuggestion,
			this._growThreadsSuggestion,
			this._player,
			this._targetServer,
			this._homeServer.cpuCores
		)
		this._resultCache.set(result.percentage, result.threadResult)
		if (result.percentage > this._maxHackPercentage) {
			// Result was larger than max so we return max
			return this._maxHackPercentage
		} else {
			// Result was smaller than max so we return result and setup suggestions for next run
			this._hackPercentageSuggestion = result.percentage
			this._growThreadsSuggestion = result.threadResult.threads.grow
			return result.percentage
		}
	}

	// TODO does this take max possible hack percentage into account?
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

	// Auxiliary calculator functions

	calculateTotalThreads(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads)
	}

	calculateTUPS(hackPercentage?: number): number {
		return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads) / (this.determineHWGWait() / 1000)
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

	calculateHackExpGain(hackPercentage?: number): number {
		if (hackPercentage !== undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this._targetServer, this._player)
			return calculateTotalThreads(this.findThreadCounts(hackPercentage).threads) * expPerThread
		}
		if (this._maxHackExpGain === undefined) {
			const expPerThread = this._ns.formulas.hacking.hackExp(this._targetServer, this._player)
			this._maxHackExpGain = calculateTotalThreads(this.findThreadCounts().threads) * expPerThread
		}
		return this._maxHackExpGain
	}

	calculateHackExpPerSecond(hackPercentage?: number): number {
		return this.calculateHackExpGain(hackPercentage) / (this.determineHWGWait() / 1000)
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

	// Accessor functions

	get maxHackPercentage(): number {
		return this._maxHackPercentage
	}

	set maxHackPercentage(maxHackPercentage: number) {
		// Trash cached old max results
		this._maxMoneyGain = undefined
		this._maxHackExpGain = undefined
		this._maxHackPercentage = maxHackPercentage
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

	// Update functions

	update(): void {
		this._player = this._ns.getPlayer()
		this._homeServer = this._ns.getServer("home")
		this._targetServer = this._ns.getServer(this._targetServer.hostname)
		this._clear()
	}

	private _clear(): void {
		this._resultCache.clear()
		this._maxMoneyGain = undefined
		this._maxHackExpGain = undefined
		this._hgwWait = undefined
	}
}
