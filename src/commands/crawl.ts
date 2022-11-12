import {AutocompleteData, NS, Server} from '@ns'
import {getNetTree, NetNode} from 'lib/NetNode'
import * as enums from 'lib/enums'

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

	const hackingLevel = ns.getHackingLevel()
	const ownedPortBreakersCount = portBreakerFiles.filter((portBreaker) => ns.fileExists(portBreaker)).length

	ns.tprintf('~~~~~~~~~~ Beginning crawl ~~~~~~~~~~')
	ns.tprintf(' ')
	if (watch) {
		const netTree = getNetTree(ns, origin, maxDepth)
		const netNodes = netTree.flat()
		// noinspection InfiniteLoopJS
		while (true) {
			travelNetTree(ns, netTree, hackingLevel, ownedPortBreakersCount)
			await ns.sleep(2000)
			netNodes.forEach((node) => node.refresh())
		}
	} else {
		travelNetTree(ns, getNetTree(ns, origin, maxDepth), hackingLevel, ownedPortBreakersCount)
	}
}

function travelNetTree(ns: NS, node: NetNode, hackingLevel: number, ownedPortBreakersCount: number): void {
	print(ns, node, hackingLevel, ownedPortBreakersCount)
	node.children.forEach((child) => travelNetTree(ns, child, hackingLevel, ownedPortBreakersCount))
}

function print(ns: NS, node: NetNode, hackingLevel: number, ownedPortBreakersCount: number): void {
	const server = node.server

	ns.tprintf('%s%s %s', indent(node.depth), header(hackingLevel, ownedPortBreakersCount, server), server.hostname)
	if (server.hasAdminRights && !server.purchasedByPlayer && !server.backdoorInstalled) {
		ns.tprintf('%s--%s', indent(node.depth), 'Can be backdoored')
	}
	if (!server.hasAdminRights) {
		ns.tprintf(
			'%s--Hacking: %s/%s, Ports: %s/%s',
			indent(node.depth),
			hackingLevel,
			server.requiredHackingSkill,
			ownedPortBreakersCount,
			server.numOpenPortsRequired
		)
	}
	if (server.moneyMax !== 0) {
		const securityLevel = server.hackDifficulty
		ns.tprintf(
			'%s--Security: %s/%s, Money: %s/%s, Growth rate: %s',
			indent(node.depth),
			ns.nFormat(securityLevel - server.minDifficulty, enums.Format.security),
			ns.nFormat(100 - server.minDifficulty, enums.Format.security),
			ns.nFormat(server.moneyAvailable, enums.Format.money),
			ns.nFormat(server.moneyMax, enums.Format.money),
			server.serverGrowth
		)
	}
	if (server.maxRam !== 0) {
		ns.tprintf(
			'%s--Cores: %s, RAM: %s/%s',
			indent(node.depth),
			server.cpuCores,
			ns.nFormat(node.usedRamMB() * 1000000, enums.Format.ram),
			ns.nFormat(node.maxRamMB() * 1000000, enums.Format.ram)
		)
	}
	ns.tprintf(' ')
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
