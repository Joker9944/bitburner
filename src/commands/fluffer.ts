import { NS } from '@ns'
import { getNetNode } from 'lib/NetNode'
import { IdentifierLogger, LogType } from 'lib/logging/Logger'
import { Toaster } from 'lib/logging/Toaster'
import { runningHackingScripts } from 'lib/runningHackingScripts'
import { executeScript } from 'lib/executeScript'
import * as enums from 'lib/enums'

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const logger = new IdentifierLogger(ns)
	const toaster = new Toaster(ns)

	const args = ns.flags([['max-threads', 100]])
	const maxThreads = args['max-threads'] as number

	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]
	const targetNode = getNetNode(ns, targetServerHostname)

	const execNode = getNetNode(ns, ns.getHostname())

	await runningHackingScripts(ns, execNode.server.hostname, targetNode.server.hostname)

	let weakenBatch = 0
	while (targetNode.server.hackDifficulty > targetNode.server.minDifficulty) {
		const securityDecrease = ns.weakenAnalyze(1, execNode.server.cpuCores)
		const offset = targetNode.server.hackDifficulty - targetNode.server.minDifficulty

		let threads = Math.ceil(offset / securityDecrease)
		if (threads > maxThreads) {
			logger.warn(LogType.log, weakenBatch, 'Weaken thread count hit limit %s > %s', threads, maxThreads)
			threads = maxThreads
		}

		const startedThreads = executeScript(
			ns,
			enums.LaunchpadScripts.weaken,
			threads,
			enums.reservedRam,
			targetNode.server.hostname
		)
		if (startedThreads < threads) {
			logger.warn(LogType.log, weakenBatch, 'Requested %s threads but only started %s', threads, startedThreads)
			toaster.warn('Failed to schedule threads', targetNode.server.hostname)
		}

		logger.info(
			LogType.log,
			weakenBatch,
			'Weakening with %s threads; excepted outcome %s/%s',
			threads,
			targetNode.server.hackDifficulty - targetNode.server.minDifficulty - threads * securityDecrease,
			100 - targetNode.server.minDifficulty
		)

		const wait = ns.getWeakenTime(targetNode.server.hostname) + 500
		logger.info(LogType.log, weakenBatch, 'Sleeping for %s', ns.tFormat(wait))
		await ns.sleep(wait)

		targetNode.refresh()
		execNode.refresh()
		logger.info(
			LogType.log,
			weakenBatch++,
			'Actual outcome: %s/%s',
			targetNode.server.hackDifficulty - targetNode.server.minDifficulty,
			100 - targetNode.server.minDifficulty
		)
	}

	const growThreads = Math.floor(maxThreads * 0.9)

	let growBatch = 0
	while (targetNode.server.moneyAvailable < targetNode.server.moneyMax) {
		const securityDecrease = ns.weakenAnalyze(1, execNode.server.cpuCores)

		const securityDeficit = ns.growthAnalyzeSecurity(growThreads)
		const weakenThreads = Math.ceil(securityDeficit / securityDecrease)

		let startedThreads = executeScript(
			ns,
			enums.LaunchpadScripts.weaken,
			weakenThreads,
			enums.reservedRam,
			targetNode.server.hostname
		)
		startedThreads += executeScript(
			ns,
			enums.LaunchpadScripts.grow,
			growThreads,
			enums.reservedRam,
			targetNode.server.hostname
		)
		const requestedThreads = growThreads + weakenThreads
		if (startedThreads < requestedThreads) {
			logger.warn(
				LogType.log,
				growBatch,
				'Requested %s threads but only started %s',
				requestedThreads,
				startedThreads
			)
			toaster.warn('Failed to schedule threads', targetNode.server.hostname)
		}

		logger.info(LogType.log, growBatch, 'Growing with %s threads', growThreads)
		logger.info(
			LogType.log,
			growBatch,
			'Countering security deficit of %s with %s threads',
			securityDeficit,
			weakenThreads
		)

		const wait = [
			ns.getGrowTime(targetNode.server.hostname) + 500,
			ns.getWeakenTime(targetNode.server.hostname) + 500,
		].reduce((previous, current) => {
			return Math.max(previous, current)
		})
		logger.info(LogType.log, growBatch, 'Sleeping for %s', ns.tFormat(wait))
		await ns.sleep(wait)

		targetNode.refresh()
		execNode.refresh()
		logger.info(
			LogType.log,
			growBatch++,
			'Outcome: %s/%s',
			ns.nFormat(targetNode.server.moneyAvailable, '$0.000a'),
			ns.nFormat(targetNode.server.moneyMax, '$0.000a')
		)
	}

	toaster.info('Fluffed', targetNode.server.hostname)
}
