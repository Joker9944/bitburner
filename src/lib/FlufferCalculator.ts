import {NS, Player, Server} from "@ns";

export class FlufferCalculator {
	private readonly _ns: NS

	private _player: Player
	private _homeServer: Server
	private _targetServer: Server

	constructor(ns: NS, targetServer: Server) {
		this._ns = ns

		this._player = ns.getPlayer()
		this._homeServer = ns.getServer("home")
		this._targetServer = targetServer
	}

	calculateSecurityDecrease(): number {
		return this._ns.weakenAnalyze(1, this._homeServer.cpuCores)
	}

	calculateNeededWeakenThreads(securityDecrease: number): number {
		const offset = this._targetServer.hackDifficulty! - this._targetServer.minDifficulty!
		return Math.ceil(offset / securityDecrease)
	}

	determineWWait(): number {
		return this._ns.formulas.hacking.weakenTime(this._targetServer, this._player)
	}

	determineWGWait(): number {
		return [
			this._ns.formulas.hacking.growTime(this._targetServer, this._player),
			this._ns.formulas.hacking.weakenTime(this._targetServer, this._player),
		].reduce((a, b) => Math.max(a, b))
	}

	ownsAdditionalCores(): boolean {
		return this._homeServer.cpuCores > 1
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
	}
}
