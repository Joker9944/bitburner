import {NS} from '@ns'
import {Logger} from 'lib/logging/Logger'
import {Toaster} from 'lib/logging/Toaster'
import {getNetNodes} from 'lib/NetNode'
import * as enums from 'lib/enums'

const portBreakerFiles = Object.values(enums.PortBreakerFiles)
const launchpadScripts = Object.values(enums.LaunchpadScripts)

// TODO implement auto backdoor, auto buy -> singularity

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')
	const logger = new Logger(ns)
	const toaster = new Toaster(ns)

	const netNodes = getNetNodes(ns)
	let rootedServersCount = netNodes.filter((node) => node.server.hasAdminRights).length

	while (rootedServersCount < netNodes.length) {
		const hackingLevel = ns.getHackingLevel()
		const ownedPortBreakersCount = portBreakerFiles.filter((portBreaker) => ns.fileExists(portBreaker)).length

		const hackableServers = netNodes.filter((node) => {
			return (
				!node.server.hasAdminRights &&
				hackingLevel >= node.server.requiredHackingSkill &&
				ownedPortBreakersCount >= node.server.numOpenPortsRequired
			)
		})

		if (hackableServers.length > 0) {
			hackableServers.forEach((node) => {
				if (ns.fileExists(enums.PortBreakerFiles.brutessh)) {
					ns.brutessh(node.server.hostname)
				}
				if (ns.fileExists(enums.PortBreakerFiles.ftpcrack)) {
					ns.ftpcrack(node.server.hostname)
				}
				if (ns.fileExists(enums.PortBreakerFiles.relaysmtp)) {
					ns.relaysmtp(node.server.hostname)
				}
				if (ns.fileExists(enums.PortBreakerFiles.httpworm)) {
					ns.httpworm(node.server.hostname)
				}
				if (ns.fileExists(enums.PortBreakerFiles.sqlinject)) {
					ns.sqlinject(node.server.hostname)
				}
				ns.nuke(node.server.hostname)
				rootedServersCount++

				ns.scp(launchpadScripts, node.server.hostname, 'home')

				logger.info()
					.withIdentifier(node.server.hostname)
					.print('Rooted')
				toaster.info('Rooted', node.server.hostname)

				if (enums.hackingFactionServers[node.server.hostname] !== undefined) {
					logger.success()
						.terminal()
						.withIdentifier(node.server.hostname)
						.withFormat('Can install backdoor to gain access to %s')
						.print(enums.hackingFactionServers[node.server.hostname])
					toaster.success(
						'Can install backdoor to access ' + enums.hackingFactionServers[node.server.hostname],
						node.server.hostname
					)
				}
			})
		} else {
			await ns.sleep(10000)
		}
		netNodes.forEach((node) => node.refresh())
	}

	logger.info()
		.print('Rooted all servers')
	toaster.success('Rooted all servers')
}
