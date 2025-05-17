import { NS } from '@ns'
import { getNetNodes } from '/lib/NetNode'

export async function main(ns: NS): Promise<void> {
	const execServerHostname = ns.getHostname()
	getNetNodes(ns).forEach((node) => {
		ns.ls(node.hostname, '.lit').forEach((file) => {
			if (!ns.fileExists(file, execServerHostname)) {
				ns.scp(file, execServerHostname, node.hostname)
			}
		})
	})
}
