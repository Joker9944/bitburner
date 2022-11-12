import {NS, Player} from '@ns'
import {NetNode} from 'lib/NetNode'
import {findBatcherHackingPercentage} from 'lib/findBatcherHackingPercentage'
import {findBatcherThreadCounts, HGWThreads} from 'lib/findBatcherThreadCounts'
import {getNetNode} from '/lib/NetNode'

export class HGWFormulasCalculator {
	homeNode: NetNode
	targetNode: NetNode
	player: Player
	maxHackPercentage: number
	private readonly _ns: NS
	private _hackPercentageSuggestion: number
	private _growThreadsSuggestion: number

	constructor(ns: NS, targetServerHostname: string, maxHackPercentage: number, hackPercentageSuggestion: number, growThreadsSuggestion: number) {
		this._ns = ns

		this._growThreadsSuggestion = growThreadsSuggestion
		this._hackPercentageSuggestion = hackPercentageSuggestion

		this.homeNode = getNetNode(ns, 'home')
		this.targetNode = getNetNode(ns, targetServerHostname)
		this.player = ns.getPlayer()

		this.maxHackPercentage = maxHackPercentage
	}

	findHackingPercentage(targetThreadCount: number): number {
		const percentage = findBatcherHackingPercentage(
			this._ns,
			targetThreadCount,
			this._hackPercentageSuggestion,
			this.maxHackPercentage,
			this._growThreadsSuggestion,
			this.player,
			this.targetNode.server,
			this.homeNode.server.cpuCores
		)
		this._hackPercentageSuggestion = percentage
		return percentage
	}

	findThreadCounts(hackPercentage: number): HGWThreads {
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

	findMaxThreadCounts(): HGWThreads {
		return this.findThreadCounts(this.maxHackPercentage)
	}

	determineHWGWait(): number {
		return [
			this._ns.formulas.hacking.hackTime(this.targetNode.server, this.player),
			this._ns.formulas.hacking.growTime(this.targetNode.server, this.player),
			this._ns.formulas.hacking.weakenTime(this.targetNode.server, this.player),
		].reduce((a, b) => Math.max(a, b))
	}

	ownsAdditionalCores(): boolean {
		return this.homeNode.server.cpuCores > 1
	}

	refresh(): void {
		this.homeNode.refresh()
		this.targetNode.refresh()
	}
}
