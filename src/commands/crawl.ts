import {AutocompleteData, NS, Server} from '@ns'
import {getNetTree, NetNode} from '/lib/NetNode'
import {Formatter} from "/lib/logging/Formatter";
import {Logger} from "/lib/logging/Logger"
import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import {calculateServerValue} from '/lib/calculateServerValue'
import {mockMaxServer} from '/lib/mockServer'
import {ArgsSchema} from '/lib/ArgsSchema'
import * as enums from '/lib/enums'
import {positionalArgument} from '/lib/positionalArgument'

const headers = {
	rooted: '>',
	available: 'H',
	unavailable: '|',
}

const portBreakerFiles = Object.values(enums.PortBreakerFiles)

const argsSchema = [
	[enums.CommonArgs.maxDepth, -1],
	[enums.CommonArgs.watch, false],
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return [...data.servers];
}

export async function main(ns: NS): Promise<void> {
	const args = ns.flags(argsSchema)
	const maxDepth = args[enums.CommonArgs.maxDepth] as number
	const watch = args[enums.CommonArgs.watch] as boolean
	const origin = positionalArgument(args, 0, ns.getHostname()) as string

	const formatter = new Formatter(ns)
	const logger = new Logger(ns)
	const printer = new NetNodePrinter(ns, formatter, logger)

	logger.logEntry()
		.terminal()
		.print('~~~~~~~~~~ Beginning crawl ~~~~~~~~~~')
	logger.logEntry()
		.terminal()
		.print(' ')
	if (watch) {
		const netTree = getNetTree(ns, origin, maxDepth)
		// noinspection InfiniteLoopJS
		while (true) {
			travelNetTree(netTree, printer)
			await ns.sleep(2000)
		}
	} else {
		travelNetTree(getNetTree(ns, origin, maxDepth), printer)
	}
}

function travelNetTree(node: NetNode, printer: NetNodePrinter): void {
	printer.printNetNode(node)
	node.children.forEach((child) => travelNetTree(child, printer))
}

class NetNodePrinter {
	private readonly _ns: NS

	private readonly _formatter: Formatter
	private readonly _logger: Logger

	readonly hackingLevel: number
	readonly ownedPortBreakersCount: number

	constructor(ns: NS, formatter: Formatter, logger: Logger) {
		this._ns = ns

		this._formatter = formatter
		this._logger = logger

		this.hackingLevel = ns.getHackingLevel()
		this.ownedPortBreakersCount = portBreakerFiles.filter((portBreaker) => ns.fileExists(portBreaker)).length
	}

	printNetNode(node: NetNode): void {
		const server = this._ns.getServer(node.hostname)
		// Server header
		this._logger.logEntry()
			.terminal()
			.withFormat('%s%s %s')
			.print(indent(node.depth), header(this.hackingLevel, this.ownedPortBreakersCount, server), server.hostname)
		// Backdoor hint
		if (server.hasAdminRights && !server.purchasedByPlayer && !server.backdoorInstalled) {
			this._logger.logEntry()
				.terminal()
				.withFormat('%s--%s')
				.print(indent(node.depth), 'Backdoor can be installed')
		}
		// Backdoor requirements
		if (!server.hasAdminRights) {
			this._logger.logEntry()
				.terminal()
				.withFormat('%s--Hacking: %s/%s, Ports: %s/%s')
				.print(indent(node.depth),
					this.hackingLevel, server.requiredHackingSkill,
					this.ownedPortBreakersCount, server.numOpenPortsRequired)
		}
		// Hacking specs
		const format: string[] = [];
		const data: unknown[] = [];
		if (server.hackDifficulty !== undefined && server.minDifficulty !== undefined) {
			format.push("Security: %s/%s")
			data.push(this._formatter.security(server.hackDifficulty - server.minDifficulty))
			data.push(this._formatter.security(100 - server.minDifficulty))
		}
		if (server.moneyAvailable !== undefined && server.moneyMax !== undefined) {
			format.push("Money: %s/%s")
			data.push(this._formatter.money(server.moneyAvailable), this._formatter.money(server.moneyMax))
		}
		if (server.serverGrowth !== undefined) {
			format.push("Growth rate: %s")
			data.push(server.serverGrowth)
		}
		if (format.length > 0) {
			this._logger.logEntry()
				.terminal()
				.withFormat('%s--' + format.join(", "))
				.print(indent(node.depth), ...data)
		}
		// Hacking hints
		if (server.moneyMax !== 0 && server.hasAdminRights) {
			// TODO get values from CnC Daemon
			const calculator = new HGWFormulasCalculator(this._ns, mockMaxServer(server), 0.3, 0.1)
			this._logger.logEntry()
				.terminal()
				.withFormat('%s--%s / sec, %s hacking exp / sec, %s thread usage, Value: %s')
				.print(indent(node.depth),
					this._formatter.money(calculator.calculateMoneyPerSecond()),
					this._formatter.exp(calculator.calculateHackExpPerSecond()),
					calculator.calculateTotalThreads(),
					this._formatter.serverValue(calculateServerValue(calculator))
				)
		}
		// Server specs
		if (server.maxRam !== 0) {
			this._logger.logEntry()
				.terminal()
				.withFormat('%s--Cores: %s, RAM: %s/%s (%s)')
				.print(indent(node.depth),
					server.cpuCores,
					this._formatter.ram(server.ramUsed),
					this._formatter.ram(server.maxRam),
					this._formatter.percentage(server.ramUsed / server.maxRam)
				)
		}
		this._logger.logEntry()
			.terminal()
			.print(' ')
	}
}

function indent(depth: number) {
	const indent = []
	for (let i = 0; i < depth; i++) {
		indent.push('--')
	}
	return indent.join('')
}

function header(hackingLevel: number, ownedPortBreakers: number, server: Server): string {
	if (server.hasAdminRights) {
		return headers.rooted
	} else if (server.requiredHackingSkill !== undefined && hackingLevel >= server.requiredHackingSkill && server.numOpenPortsRequired !== undefined && ownedPortBreakers >= server.numOpenPortsRequired) {
		return headers.available
	} else {
		return headers.unavailable
	}
}
