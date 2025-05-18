import {NS, Server} from '@ns'
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
	portBreakerWarningCount = 0

	constructor(ns: NS) {
		this.ns = ns

		this.logger = new Logger(ns)
		this.toaster = new Toaster(ns)

		this.execServerHostname = ns.getHostname()

		this.net = getNetNodes(ns, this.execServerHostname)
		this.rootedServersCount = this.net
			.map(node => ns.getServer(node.hostname))
			.filter(server => server.hasAdminRights)
			.length
		this.logger
			.info()
			.withFormat('%s server(s) already rooted')
			.print(this.rootedServersCount)
	}

	async main(): Promise<void> {
		while (this.rootedServersCount < this.net.length) {
			const hackingLevel = this.ns.getHackingLevel()
			const ownedPortBreakersCount = this.countPortBreakerFiles()

			const hackingSkillsMet = this.net
				.map(node => this.ns.getServer(node.hostname))
				.filter(server => !server.hasAdminRights)
				.filter(server => server.requiredHackingSkill !== undefined)
				.filter(server => hackingLevel >= server.requiredHackingSkill!)
			const hackableServers = hackingSkillsMet
				.filter(server => ownedPortBreakersCount >= server.numOpenPortsRequired!)

			const missingPortBreakerServersCount = hackingSkillsMet.length - hackableServers.length
			if (missingPortBreakerServersCount > 0 && missingPortBreakerServersCount !== this.portBreakerWarningCount) {
				this.portBreakerWarningCount = missingPortBreakerServersCount
				this.logger.warn()
					.withFormat('Could root %s server(s) with more port breakers')
					.print(missingPortBreakerServersCount)
			}

			if (hackableServers.length > 0) {
				for (const node of hackableServers) {
					this.root(node)
					this.copyLaunchpad(node)
				}
				this.portBreakerWarningCount = 0
			} else {
				await this.ns.sleep(10000)
			}
		}

		this.logger.info().print('Rooted all servers')
		this.toaster.success('Rooted all servers', 'r00ter')
	}

	countPortBreakerFiles(): number {
		return portBreakerFiles.filter((portBreaker) => this.ns.fileExists(portBreaker, this.execServerHostname)).length
	}

	root(server: Server): void {
		if (this.ns.fileExists(enums.PortBreakerFiles.brutessh, this.execServerHostname)) {
			this.ns.brutessh(server.hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.ftpcrack, this.execServerHostname)) {
			this.ns.ftpcrack(server.hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.relaysmtp, this.execServerHostname)) {
			this.ns.relaysmtp(server.hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.httpworm, this.execServerHostname)) {
			this.ns.httpworm(server.hostname)
		}
		if (this.ns.fileExists(enums.PortBreakerFiles.sqlinject, this.execServerHostname)) {
			this.ns.sqlinject(server.hostname)
		}
		this.ns.nuke(server.hostname)
		this.rootedServersCount++

		this.logger.info()
			.withIdentifier(server.hostname)
			.print('Rooted')
		this.toaster.info('Rooted', server.hostname)
	}

	copyLaunchpad(server: Server): void {
		this.ns.scp(launchpadScripts, server.hostname, this.execServerHostname)
	}
}
