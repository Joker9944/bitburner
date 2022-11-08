import {NS} from '@ns'

export async function main(ns: NS): Promise<void> {
	const moneyPerHackThread = ns.hackAnalyze('n00dles') * ns.getServerMaxMoney('n00dles')
	const actuallyStolen = await ns.hack('n00dles')
	ns.tprintf('%s / %s', moneyPerHackThread, actuallyStolen)
	await ns.grow('n00dles')
	await ns.weaken('n00dles')
}
