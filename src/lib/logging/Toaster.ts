import { NS } from '@ns'
import { Severity } from 'lib/logging/Severity'

const defaultLength = 10000

export class Toaster {
	ns: NS

	constructor(ns: NS) {
		this.ns = ns
	}

	info(message: string): void
	info(message: string, identifier: unknown): void
	info(message: string, identifier?: unknown): void {
		if (identifier) {
			this.toast(message, Severity.info, identifier)
		} else {
			this.toast(message, Severity.info)
		}
	}

	warn(message: string): void
	warn(message: string, identifier: unknown): void
	warn(message: string, identifier?: unknown): void {
		if (identifier) {
			this.toast(message, Severity.warning, identifier)
		} else {
			this.toast(message, Severity.warning)
		}
	}

	error(message: string): void
	error(message: string, identifier: unknown): void
	error(message: string, identifier?: unknown): void {
		if (identifier) {
			this.toast(message, Severity.error, identifier)
		} else {
			this.toast(message, Severity.error)
		}
	}

	success(message: string): void
	success(message: string, identifier: unknown): void
	success(message: string, identifier?: unknown): void {
		if (identifier) {
			this.toast(message, Severity.success, identifier)
		} else {
			this.toast(message, Severity.success)
		}
	}

	toast(message: string, severity: Severity): void
	toast(message: string, severity: Severity, identifier: unknown): void
	toast(message: string, severity: Severity, identifier?: unknown): void {
		if (identifier) {
			message = '[' + identifier + '] ' + message
		}
		this.ns.toast(message, severity.toLowerCase(), defaultLength)
	}
}
