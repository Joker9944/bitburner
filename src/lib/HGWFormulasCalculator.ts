import { NS, Player } from '@ns'
import { NetNode } from 'lib/NetNode'
import { findBatcherHackingPercentage } from 'lib/findBatcherHackingPercentage'
import { findBatcherThreadCounts, HGWThreads } from 'lib/findBatcherThreadCounts'

export class HGWFormulasCalculator {
	private _ns: NS
	private _hackPercentageSuggestion: number
	private _growThreadsSuggestion: number

	targetNode: NetNode
	player: Player

	maxHackPercentage: number

	constructor(
		ns: NS,
		targetNode: NetNode,
		maxHackPercentage: number,
		hackPercentageSuggestion: number,
		growThreadsSuggestion: number
	) {
		this._ns = ns
		this.targetNode = targetNode
		this._growThreadsSuggestion = growThreadsSuggestion
		this._hackPercentageSuggestion = hackPercentageSuggestion
		this.player = ns.getPlayer()
		this.maxHackPercentage = maxHackPercentage
	}

	findHackingPercentage(targetThreadCount: number, cores: number): number {
		const percentage = findBatcherHackingPercentage(
			this._ns,
			targetThreadCount,
			this._hackPercentageSuggestion,
			this.maxHackPercentage,
			this._growThreadsSuggestion,
			this.player,
			this.targetNode.server,
			cores
		)
		this._hackPercentageSuggestion = percentage
		return percentage
	}

	findThreadCounts(hackPercentage: number, cores: number): HGWThreads {
		const threads = findBatcherThreadCounts(
			this._ns,
			hackPercentage,
			this._growThreadsSuggestion,
			this.player,
			this.targetNode.server,
			cores
		)
		this._growThreadsSuggestion = threads.grow
		return threads
	}

	determineWait(): number {
		return [
			this._ns.formulas.hacking.hackTime(this.targetNode.server, this.player),
			this._ns.formulas.hacking.growTime(this.targetNode.server, this.player),
			this._ns.formulas.hacking.weakenTime(this.targetNode.server, this.player),
		].reduce((a, b) => Math.max(a, b))
	}

	refresh(): void {
		this.targetNode.refresh()
		this.player = this._ns.getPlayer()
	}
}
