import { NS } from '@ns'
import { Severity } from 'lib/logging/Severity'

export class Logger {
	ns: NS

	constructor(ns: NS) {
		this.ns = ns
	}

	info(type: LogType, format: string, ...args: unknown[]): void {
		this.print(type, Severity.info + ': ' + format, ...args)
	}

	warn(type: LogType, format: string, ...args: unknown[]): void {
		this.print(type, Severity.warning + ': ' + format, ...args)
	}

	error(type: LogType, format: string, ...args: unknown[]): void {
		this.print(type, Severity.error + ': ' + format, ...args)
	}

	success(type: LogType, format: string, ...args: unknown[]): void {
		this.print(type, Severity.success + ': ' + format, ...args)
	}

	print(type: LogType, format: string, ...args: unknown[]): void {
		switch (type) {
			case LogType.log:
				this.ns.printf(format, ...args)
				break
			case LogType.terminal:
				this.ns.tprintf(format, ...args)
				break
		}
	}
}

export class IdentifierLogger {
	ns: NS
	private _logger: Logger

	constructor(ns: NS) {
		this.ns = ns
		this._logger = new Logger(ns)
	}

	info(
		type: LogType,
		identifier: unknown,
		format: string,
		...args: unknown[]
	): void {
		args.unshift(identifier)
		this._logger.print(type, Severity.info + ' [%s]: ' + format, ...args)
	}

	warn(
		type: LogType,
		identifier: unknown,
		format: string,
		...args: unknown[]
	): void {
		args.unshift(identifier)
		this._logger.print(type, Severity.warning + ' [%s]: ' + format, ...args)
	}

	error(
		type: LogType,
		identifier: unknown,
		format: string,
		...args: unknown[]
	): void {
		args.unshift(identifier)
		this._logger.print(type, Severity.error + ' [%s]: ' + format, ...args)
	}

	success(
		type: LogType,
		identifier: unknown,
		format: string,
		...args: unknown[]
	): void {
		args.unshift(identifier)
		this._logger.print(type, Severity.success + ' [%s]: ' + format, ...args)
	}

	print(
		type: LogType,
		identifier: unknown,
		format: string,
		...args: unknown[]
	): void {
		args.unshift(identifier)
		this._logger.print(type, '[%s]: ' + format, ...args)
	}
}

export enum LogType {
	terminal,
	log,
}
