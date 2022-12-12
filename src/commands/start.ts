import {NS} from '@ns'
import * as enums from 'lib/enums'

const daemonScripts = Object.values(enums.DaemonScripts)

export async function main(ns: NS): Promise<void> {
	daemonScripts.forEach(script => ns.exec(script, 'home'))
}
