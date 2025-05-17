import {NS} from '@ns'
import {Logger} from 'lib/logging/Logger'
import {Toaster} from 'lib/logging/Toaster'
import {getNetNodes, NetNode} from 'lib/NetNode'
import * as enums from "/lib/enums";

const backdoorPropertyServers = Object.values(enums.BackdoorPropertyServers) as string[]

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')
	await new Backd00rDaemon(ns).main()
}

export class Backd00rDaemon {
	readonly ns: NS

	readonly logger: Logger
	readonly toaster: Toaster

	readonly execServerHostname: string
	readonly net: NetNode[]

	backdooredServersCount: number

	constructor(ns: NS) {
		this.ns = ns

		this.logger = new Logger(ns)
		this.toaster = new Toaster(ns)

		this.execServerHostname = 'home'

		this.net = getNetNodes(ns, this.execServerHostname)
			.filter(node => node.hostname !== 'home')
			.filter(node => ns.getServer(node.hostname).backdoorInstalled !== undefined)
		this.backdooredServersCount = this.net
			.map(node => ns.getServer(node.hostname))
			.filter(server => server.backdoorInstalled)
			.length
		this.logger
			.info()
			.withFormat('%s server(s) already backdoored')
			.print(this.backdooredServersCount)
	}

	async main(): Promise<void> {
		while (this.backdooredServersCount < this.net.length) {
			const backdoorableServers = this.net
				.filter(node => {
					const server = this.ns.getServer(node.hostname)
					return !server.backdoorInstalled && server.hasAdminRights
				})
				.sort((a, b) => {
					const serverA = this.ns.getServer(a.hostname)
					const serverB = this.ns.getServer(b.hostname)
					const includesA = backdoorPropertyServers.includes(serverA.hostname)
					const includesB = backdoorPropertyServers.includes(serverB.hostname)
					if (includesA && includesB) {
						return (serverA.requiredHackingSkill ?? 0) - (serverB.requiredHackingSkill ?? 0)
					} else if (includesA) {
						return -1
					} else if (includesB) {
						return 1
					} else {
						return (serverA.requiredHackingSkill ?? 0) - (serverB.requiredHackingSkill ?? 0)
					}
				})
			if (backdoorableServers.length > 0) {
				const target = backdoorableServers[0]
				await this.backdoor(target)
			} else {
				await this.ns.sleep(10000)
			}
		}

		this.logger.info()
			.print('Installed a backdoor on all servers')
		this.toaster.success('Installed a backdoor on all servers', 'backd00r')
	}

	async backdoor(target: NetNode): Promise<void> {
		target.searchPathUp(this.execServerHostname).forEach(path => {
			this.ns.singularity.connect(path.hostname)
		})
		await this.ns.singularity.installBackdoor()
		this.ns.singularity.connect(this.execServerHostname)
		this.logger.info()
			.withIdentifier(target.hostname)
			.print('Installed backdoor')
		this.toaster.info('Installed backdoor', target.hostname)
	}
}
