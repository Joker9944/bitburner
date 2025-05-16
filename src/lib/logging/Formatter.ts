import {NS} from '@ns'

export class Formatter {
	private readonly _ns: NS

	constructor(ns: NS) {
		this._ns = ns
	}

	security(n: number): string {
		return this._ns.formatNumber(n) // 0.[000]
	}

	money(n: number): string {
		return '$' + this._ns.formatNumber(n) // $0.000a
	}

	ram(n: number): string {
		return this._ns.formatRam(n) // 0.00b
	}

	percentage(n: number): string {
		return this._ns.formatPercent(n) // 0.00%
	}

	rep(n: number): string {
		return this._ns.formatNumber(n) // 0.000a
	}

	exp(n: number): string {
		return this._ns.formatNumber(n) // 0.000a
	}

	serverValue(n: number): string {
		return this._ns.formatNumber(n, 2) // 0.00a
	}
}
