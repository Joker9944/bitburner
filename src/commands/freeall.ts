import {NS} from '@ns'
import {getNetNodes} from 'lib/NetNode'
import {Formatter} from "/lib/logging/Formatter";
import {Logger} from "/lib/logging/Logger";

export async function main(ns: NS): Promise<void> {

	const formatter = new Formatter(ns)
	const logger = new Logger(ns)

	let ramTotal = 0
	let ramUsed = 0
	getNetNodes(ns)
		.map(node => ns.getServer(node.hostname))
		.filter(server => server.hasAdminRights)
		.forEach(server => {
			ramTotal += server.maxRam
			ramUsed += server.ramUsed
		})

	const ramTotalFormated = formatter.ram(ramTotal)
	const ramUsedFormated = formatter.ram(ramTotal)
	const ramAvailableFormated = formatter.ram(ramTotal - ramUsed)

	const padding = Math.max(ramTotalFormated.length, ramUsedFormated.length, ramAvailableFormated.length)

	logger.logEntry()
		.terminal()
		.withFormat("Total:".padEnd(11 + padding - ramTotalFormated.length, ' ') + "%s")
		.print(ramTotalFormated)
	logger.logEntry()
		.terminal()
		.withFormat("Used:".padEnd(11 + padding - ramUsedFormated.length, ' ') + "%s (%s)")
		.print(ramUsedFormated, formatter.percentage(ramUsed / ramTotal))
	logger.logEntry()
		.terminal()
		.withFormat("Available:".padEnd(11 + padding - ramAvailableFormated.length, ' ') + "%s")
		.print(ramAvailableFormated)
}
