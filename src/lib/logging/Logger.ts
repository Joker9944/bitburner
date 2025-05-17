import {NS} from '@ns'
import {Severity} from 'lib/logging/Severity'

export class Logger {
	private readonly _ns: NS

	constructor(ns: NS) {
		this._ns = ns
	}

	info(): LogEntry {
		return new LogEntry(this._ns).info()
	}

	warn(): LogEntry {
		return new LogEntry(this._ns).warn()
	}

	error(): LogEntry {
		return new LogEntry(this._ns).error()
	}

	success(): LogEntry {
		return new LogEntry(this._ns).success()
	}

	logEntry(): LogEntry {
		return new LogEntry(this._ns)
	}

	spacer(): void {
		new LogEntry(this._ns).print("----------")
	}
}

export class LogEntry {
	private readonly _ns: NS
	private type: LogType = LogType.log
	private severity?: Severity
	private format?: string
	private identifier?: unknown

	constructor(ns: NS) {
		this._ns = ns
	}

	terminal(): LogEntry {
		this.type = LogType.terminal
		return this
	}

	log(): LogEntry {
		this.type = LogType.log
		return this
	}

	info(): LogEntry {
		this.severity = Severity.info
		return this
	}

	warn(): LogEntry {
		this.severity = Severity.warning
		return this
	}

	error(): LogEntry {
		this.severity = Severity.error
		return this
	}

	success(): LogEntry {
		this.severity = Severity.success
		return this
	}

	withFormat(format: string): LogEntry {
		this.format = format
		return this
	}

	withIdentifier(identifier: unknown): LogEntry {
		this.identifier = identifier
		return this
	}

	print(...args: unknown[]): void {
		let format = this.format === undefined ? defaultFormat(args) : this.format
		if (this.identifier !== undefined && this.severity !== undefined) {
			format = '%s [%s]: ' + format
			args.unshift(this.identifier)
			args.unshift(this.severity)
		} else if (this.identifier !== undefined) {
			format = '[%s]: ' + format
			args.unshift(this.identifier)
		} else if (this.severity !== undefined) {
			format = '%s: ' + format
			args.unshift(this.severity)
		}
		switch (this.type) {
			case LogType.terminal: {
				this._ns.tprintf(format, ...args)
				break
			}
			case LogType.log: {
				this._ns.printf(format, ...args)
			}
		}
	}
}

function defaultFormat(...args: unknown[]) {
	const format = []
	for (let i = 0; i < args.length; i++) {
		format.push('%s')
	}
	return format.join(' ')
}

export enum LogType {
	terminal,
	log,
}

export const {terminal, log} = LogType
