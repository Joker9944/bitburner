import {NS} from '@ns'
import {getNetNode} from 'lib/NetNode'
import {Logger, LogType} from 'lib/logging/Logger'
import {runningHackingScripts} from 'lib/runningHackingScripts'
import * as enums from 'lib/enums'

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const logger = new Logger(ns)

	const args = ns.flags([
		['max-hack-percentage', -1],
	])
	const maxHackPercentage = args['max-hack-percentage'] as number

	if (maxHackPercentage !== -1 && maxHackPercentage <= 0 && maxHackPercentage > 1) {
		logger.error(LogType.terminal, 'Hack percentage %s is invalid', maxHackPercentage)
		return
	}

	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]
	const targetNode = getNetNode(ns, targetServerHostname)

	const execNode = getNetNode(ns, ns.getHostname())

	const batcherRunning =
		ns.ps(execNode.server.hostname).filter((script) => {
			return (
				script.filename == enums.BatcherScripts.batcher &&
				script.args.includes(targetNode.server.hostname)
			)
		}).length > 0

	if (batcherRunning) {
		logger.info(LogType.terminal, 'Server %s is already being batched', targetNode.server.hostname)
		return
	}

	await runningHackingScripts(ns, targetNode.server.hostname)

	if (
		targetNode.server.hackDifficulty > targetNode.server.minDifficulty ||
		targetNode.server.moneyAvailable < targetNode.server.moneyMax
	) {
		logger.info(LogType.log, 'Fluffing %s', targetNode.server.hostname)
		logger.info(LogType.terminal, 'Fluffing %s', targetNode.server.hostname)
		ns.exec(enums.BatcherScripts.fluffer, execNode.server.hostname, 1, targetNode.server.hostname)
		while (ns.isRunning(enums.BatcherScripts.fluffer, execNode.server.hostname, targetNode.server.hostname)) {
			await ns.sleep(1000)
		}
	}

	const batcherArgs = [targetNode.server.hostname]
	if (maxHackPercentage !== -1) {
		batcherArgs.unshift('--max-hack-percentage', String(maxHackPercentage))
	}

	logger.info(LogType.log, 'Spawning formulas batcher targeting %s', targetNode.server.hostname)
	logger.info(LogType.terminal, 'Spawning formulas batcher targeting %s', targetNode.server.hostname)
	ns.spawn(enums.BatcherScripts.batcher, 1, ...batcherArgs)
}
