import {NS} from '@ns'
import {findExpCost} from '/lib/formulas/findExpCost'

export async function main(ns: NS): Promise<void> {
	const expEarned = ns.getPlayer().exp.hacking
	const expNeededTotal = findExpCost(ns, 9000)
	const expNeeded = expNeededTotal - expEarned
	const expRate = ns.ps('home').filter(process => process.filename.startsWith('/bin/'))
		.map(process => ns.getScriptExpGain(process.filename, 'home', ...process.args))
		.reduce((a, b) => a + b) / 1000
	ns.tprint(ns.tFormat(expNeeded / expRate))
}
