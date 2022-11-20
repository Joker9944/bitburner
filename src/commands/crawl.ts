import {AutocompleteData, NS, Server} from '@ns'
import {getNetTree, NetNode} from '/lib/NetNode'
import * as enums from '/lib/enums'
import {Logger} from "/lib/logging/Logger";
import {HGWFormulasCalculator} from "/lib/HGWFormulasCalculator";
import {calculateServerValue} from "/lib/calculateServerValue";
import {mockMaxServer} from "/lib/mockServer";

const headers = {
	rooted: '>',
	available: 'H',
	unavailable: '|',
}

const portBreakerFiles = Object.values(enums.PortBreakerFiles)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	return [...data.servers, '--max-depth', '--watch'];
}

export async function main(ns: NS): Promise<void> {
	const args = ns.flags([
		['max-depth', -1],
		['watch', false],
	])
	const maxDepth = args['max-depth'] as number
	const watch = args['watch'] as boolean
	const origin = (args['_'] as string[]).length === 0 ? ns.getHostname() : (args['_'] as string[])[0]

	const logger = new Logger(ns)
	const printer = new NetNodePrinter(ns, logger)

	logger.print()
		.terminal()
		.print('~~~~~~~~~~ Beginning crawl ~~~~~~~~~~')
	logger.print()
		.terminal()
		.print(' ')
	if (watch) {
		const netTree = getNetTree(ns, origin, maxDepth)
		const netNodes = netTree.flat()
		// noinspection InfiniteLoopJS
		while (true) {
			travelNetTree(netTree, printer)
			await ns.sleep(2000)
			netNodes.forEach((node) => node.refresh())
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
	readonly hackingLevel: number
	readonly ownedPortBreakersCount: number
	private readonly _ns: NS
	private readonly _logger: Logger

	constructor(ns: NS, logger: Logger) {
		this._ns = ns
		this._logger = logger

		this.hackingLevel = ns.getHackingLevel()
		this.ownedPortBreakersCount = portBreakerFiles.filter((portBreaker) => ns.fileExists(portBreaker)).length
	}

	printNetNode(node: NetNode): void {
		this._logger.print()
			.terminal()
			.withFormat('%s%s %s')
			.print(indent(node.depth), header(this.hackingLevel, this.ownedPortBreakersCount, node.server), node.server.hostname)
		if (node.server.hasAdminRights && !node.server.purchasedByPlayer && !node.server.backdoorInstalled) {
			this._logger.print()
				.terminal()
				.withFormat('%s--%s')
				.print(indent(node.depth), 'Backdoor can be installed')
		}
		if (!node.server.hasAdminRights) {
			this._logger.print()
				.terminal()
				.withFormat('%s--Hacking: %s/%s, Ports: %s/%s')
				.print(indent(node.depth),
					this.hackingLevel, node.server.requiredHackingSkill,
					this.ownedPortBreakersCount, node.server.numOpenPortsRequired)
		}
		if (node.server.moneyMax !== 0) {
			this._logger.print()
				.terminal()
				.withFormat('%s--Security: %s/%s, Money: %s/%s, Growth rate: %s')
				.print(indent(node.depth),
					this._ns.nFormat(node.server.hackDifficulty - node.server.minDifficulty, enums.Format.security),
					this._ns.nFormat(100 - node.server.minDifficulty, enums.Format.security),
					this._ns.nFormat(node.server.moneyAvailable, enums.Format.money),
					this._ns.nFormat(node.server.moneyMax, enums.Format.money),
					node.server.serverGrowth)
		}
		if (node.server.moneyMax !== 0 && node.server.hasAdminRights) {
			const mockedServer = mockMaxServer(node.server)
			const mockedNode = node.mockNode(mockedServer)
			const calculator = new HGWFormulasCalculator(this._ns, mockedNode, 0.2, 0.1, 200)
			this._logger.print()
				.terminal()
				.withFormat('%s--%s / sec, %s hacking exp / sec, %s threads / sec, Value: %s')
				.print(indent(node.depth),
					this._ns.nFormat(calculator.calculateMPS(), enums.Format.money),
					this._ns.nFormat(calculator.calculateEPS(), enums.Format.exp),
					this._ns.nFormat(calculator.calculateTUPS(), enums.Format.threads),
					this._ns.nFormat(calculateServerValue(calculator), enums.Format.serverValue))
		}
		if (node.server.maxRam !== 0) {
			this._logger.print()
				.terminal()
				.withFormat('%s--Cores: %s, RAM: %s/%s')
				.print(indent(node.depth),
					node.server.cpuCores,
					this._ns.nFormat(node.usedRamMB() * 1000000, enums.Format.ram),
					this._ns.nFormat(node.maxRamMB() * 1000000, enums.Format.ram))
		}
		this._logger.print()
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
	} else if (hackingLevel >= server.requiredHackingSkill && ownedPortBreakers >= server.numOpenPortsRequired) {
		return headers.available
	} else {
		return headers.unavailable
	}
}
