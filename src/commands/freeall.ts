import {NS} from '@ns'
import {getNetNodes} from 'lib/NetNode'
import {Formatter} from "/lib/logging/Formatter";
import {Logger} from "/lib/logging/Logger";

export async function main(ns: NS): Promise<void> {

	const formatter = new Formatter(ns)
	const logger = new Logger(ns)

	let ramUsed = 0
	let ramTotal = 0
	getNetNodes(ns)
		.map(node => ns.getServer(node.hostname))
		.filter(server => server.hasAdminRights)
		.forEach(server => {
			ramUsed += server.ramUsed
			ramTotal += server.maxRam
		})
	const ramUsedPercentage = ramUsed / ramTotal
	const ramAvailable = ramTotal - ramUsed

	const digitsCountTotal = numDigits(ramTotal)
	logger.logEntry()
		.terminal()
		.withFormat("Total:".padEnd(11) + "%s")
		.print(formatter.ram(ramTotal))
	logger.logEntry()
		.terminal()
		.withFormat("Used:".padEnd(11 + digitsCountTotal - numDigits(ramUsed), " ") + "%s (%s)")
		.print(formatter.ram(ramUsed), formatter.percentage(ramUsedPercentage))
	logger.logEntry()
		.terminal()
		.withFormat("Available:".padEnd(11 + digitsCountTotal - numDigits(ramAvailable), " ") + "%s")
		.print(formatter.ram(ramAvailable))
}

function numDigits(n: number) {
	return (Math.log10((n ^ (n >> 31)) - (n >> 31)) | 0) + 1;
}
