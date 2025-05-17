import {NS} from '@ns'
import {Logger} from 'lib/logging/Logger'
import {Toaster} from 'lib/logging/Toaster'
import {getNetNodes, NetNode} from 'lib/NetNode'
import * as enums from 'lib/enums'

const portBreakerFiles = Object.values(enums.PortBreakerFiles)
const launchpadScripts = Object.values(enums.LaunchpadScripts)

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')
	await new R00terDaemon(ns).main()
}

// TODO buy servers for daemons
export class R00terDaemon {
	readonly ns: NS

	readonly logger: Logger
	readonly toaster: Toaster

	readonly execServerHostname: string
	readonly net: NetNode[]

	rootedServersCount: number

	constructor(ns: NS) {
		this.ns = ns

		this.logger = new Logger(ns)
		this.toaster = new Toaster(ns)

		this.execServerHostname = ns.getHostname()

		this.net = getNetNodes(ns, this.execServerHostname)
		this.rootedServersCount = this.net.filter((node) => node.server.hasAdminRights).length
	}

	async main(): Promise<void> {
		while (this.rootedServersCount < this.net.length) {
			const hackingLevel = this.ns.getHackingLevel()
			const ownedPortBreakersCount = this.countPortBreakerFiles()

			const hackingSkillsMet = this.net.filter(node => !node.server.hasAdminRights && hackingLevel >= (node.server.requiredHackingSkill ?? 0))
			const hackableServers = hackingSkillsMet.filter(node => ownedPortBreakersCount >= (node.server.numOpenPortsRequired ?? 0))

			if (hackingSkillsMet.length > hackableServers.length) {
				this.logger.warn()
					.withIdentifier('Could root %s server(s) with more port breakers')
					.print(hackingSkillsMet.length)
			}

			if (hackableServers.length > 0) {
				for (const node of hackableServers) {
					this.root(node)
					this.copyLaunchpad(node)
				}
			} else {
				await this.ns.sleep(10000)
			}
			this.net.forEach((node) => node.update())
		}

		this.logger.info()
			.print('Rooted all servers')
		this.toaster.success('Rooted all servers', 'r00ter')
	}

	countPortBreakerFiles(): number {
		return portBreakerFiles.filter((portBreaker) => this.ns.fileExists(portBreaker, this.execServerHostname)).length
	}

	root(node: NetNode): void {
		const hostname = node.server.hostname
		if (this.ns.fileExists(enums.PortBreakerFiles.brutessh, this.execServerHostname)) {
			this.ns.brutessh(hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.ftpcrack, this.execServerHostname)) {
			this.ns.ftpcrack(hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.relaysmtp, this.execServerHostname)) {
			this.ns.relaysmtp(hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.httpworm, this.execServerHostname)) {
			this.ns.httpworm(hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.sqlinject, this.execServerHostname)) {
			this.ns.sqlinject(hostname)
		}
		this.ns.nuke(hostname)
		this.rootedServersCount++

		this.logger.info()
			.withIdentifier(hostname)
			.print('Rooted')
		this.toaster.info('Rooted', hostname)
	}

	copyLaunchpad(node: NetNode): void {
		this.ns.scp(launchpadScripts, node.server.hostname, this.execServerHostname)
	}
}
