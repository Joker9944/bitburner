import {NetNode} from "/lib/NetNode";
import {NS, Player} from "@ns";


export class FlufferCalculator {
	targetNode: NetNode
	player: Player
	cores: number
	private readonly _ns: NS

	constructor(ns: NS, targetNode: NetNode) {
		this._ns = ns

		this.targetNode = targetNode
		this.player = ns.getPlayer()
		this.cores = ns.getServer('home').cpuCores
	}

	calculateSecurityDecrease(): number {
		return this._ns.weakenAnalyze(1, this.cores)
	}

	calculateNeededWeakenThreads(securityDecrease: number): number {
		const offset = this.targetNode.server.hackDifficulty - this.targetNode.server.minDifficulty
		return Math.ceil(offset / securityDecrease)
	}

	determineWWait(): number {
		return this._ns.formulas.hacking.weakenTime(this.targetNode.server, this.player)
	}

	determineWGWait(): number {
		return [
			this._ns.formulas.hacking.growTime(this.targetNode.server, this.player),
			this._ns.formulas.hacking.weakenTime(this.targetNode.server, this.player),
		].reduce((a, b) => Math.max(a, b))
	}

	refresh(): void {
		this.targetNode.refresh()
		this.player = this._ns.getPlayer()
		// TODO this is ugly
		this.cores = this._ns.getServer('home').cpuCores
	}
}
