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

	backdoorInstalledServers: number

	constructor(ns: NS) {
		this.ns = ns

		this.logger = new Logger(ns)
		this.toaster = new Toaster(ns)

		this.execServerHostname = ns.getHostname()

		this.net = getNetNodes(ns, this.execServerHostname).filter(node => !node.server.purchasedByPlayer)
		this.backdoorInstalledServers = this.net.filter(node => node.server.backdoorInstalled).length
	}

	async main(): Promise<void> {
		while (this.backdoorInstalledServers < this.net.length) {
			const backdoorInstallableServers = this.net.filter(node => !node.server.backdoorInstalled && node.server.hasAdminRights)
				.sort((a, b) => {
					const includesA = backdoorPropertyServers.includes(a.server.hostname)
					const includesB = backdoorPropertyServers.includes(b.server.hostname)
					if (includesA && includesB) {
						return (a.server.requiredHackingSkill ?? 0) - (b.server.requiredHackingSkill ?? 0)
					} else if (includesA) {
						return -1
					} else if (includesB) {
						return 1
					} else {
						return (a.server.requiredHackingSkill ?? 0) - (b.server.requiredHackingSkill ?? 0)
					}
				})
			if (backdoorInstallableServers.length > 0) {
				const target = backdoorInstallableServers[0]
				await this.backdoor(target)
			} else {
				await this.ns.sleep(10000)
			}
			this.net.forEach((node) => node.update())
		}

		this.logger.info()
			.print('Installed a backdoor on all servers')
		this.toaster.success('Installed a backdoor on all servers', 'backd00r')
	}

	async backdoor(node: NetNode): Promise<void> {
		node.searchPathUp(this.execServerHostname).forEach(path => {
			this.ns.singularity.connect(path.server.hostname)
		})
		await this.ns.singularity.installBackdoor()
		this.ns.singularity.connect(this.execServerHostname)
		const hostname = node.server.hostname
		this.logger.info()
			.withIdentifier(hostname)
			.print('Installed backdoor')
		this.toaster.info('Installed backdoor', hostname)
	}
}
