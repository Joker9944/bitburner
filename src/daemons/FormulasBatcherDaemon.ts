import { NS } from '@ns'
import { getNetNode } from 'lib/NetNode'
import { Logger, IdentifierLogger, LogType } from 'lib/logging/Logger'
import { Toaster } from 'lib/logging/Toaster'
import { runningHackingScripts } from 'lib/runningHackingScripts'
import { executeScript } from 'lib/executeScript'
import * as enums from 'lib/enums'
import { HGWFormulasCalculator } from '/lib/HGWFormulasCalculator'

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	// logging
	const logger = new IdentifierLogger(ns)
	const toaster = new Toaster(ns)

	// arguments
	const args = ns.flags([
		['max-threads', 0],
		['max-hack-percentage', 0.3],
		['grow-thread-suggestion', 200],
	])
	const maxThreads = args['max-threads'] as number
	const maxHackPercentage = args['max-hack-percentage'] as number
	const growThreadsSuggestion = args['grow-thread-suggestion'] as number

	if (maxThreads === 0) {
		new Logger(ns).error(LogType.terminal, 'Argument --max-threads required')
		return
	}

	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]
	const targetNode = getNetNode(ns, targetServerHostname)

	const execNode = getNetNode(ns, ns.getHostname())

	// init
	const calculator = new HGWFormulasCalculator(ns, targetNode, maxHackPercentage, 0.2, growThreadsSuggestion)

	await runningHackingScripts(ns, execNode.server.hostname, targetNode.server.hostname)

	let hackPercentage = 0.2
	let batch = 0
	while (true) {
		if (batch % 10 === 0) {
			logger.info(LogType.log, batch, 'Set max threads to %s', maxThreads)
			hackPercentage = calculator.findHackingPercentage(maxThreads, execNode.server.cpuCores)
			logger.info(LogType.log, batch, 'Set hack percentage to %s', hackPercentage)
		}

		const threads = calculator.findThreadCounts(hackPercentage, execNode.server.cpuCores)

		if (threads.totalSecurityIncrease > 100 - targetNode.server.minDifficulty) {
			logger.warn(
				LogType.log,
				batch,
				'Hitting max security %s / %s',
				ns.nFormat(threads.totalSecurityIncrease, enums.Format.security),
				ns.nFormat(100 - targetNode.server.minDifficulty, enums.Format.security)
			)
			toaster.warn('Hitting max security', targetNode.server.hostname)
		}

		// exec
		let startedThreads = executeScript(
			ns,
			enums.LaunchpadScripts.weaken,
			threads.weaken,
			enums.reservedRam,
			targetNode.server.hostname
		)
		startedThreads += executeScript(
			ns,
			enums.LaunchpadScripts.grow,
			threads.grow,
			enums.reservedRam,
			targetNode.server.hostname
		)
		startedThreads += executeScript(
			ns,
			enums.LaunchpadScripts.hack,
			threads.hack,
			enums.reservedRam,
			targetNode.server.hostname
		)
		if (startedThreads < threads.total()) {
			logger.warn(LogType.log, batch, 'Requested %s threads but only started %s', threads.total(), startedThreads)
			toaster.warn('Failed to schedule threads', targetNode.server.hostname)
		}

		const wait = calculator.determineWait()
		logger.info(
			LogType.log,
			batch,
			'HGW: %s / %s / %s / %s, Duration: %s',
			threads.hack,
			threads.grow,
			threads.weaken,
			threads.total(),
			ns.tFormat(wait, true)
		)
		await ns.sleep(wait)

		calculator.refresh()
		targetNode.refresh()
		execNode.refresh()

		if (calculator.server.moneyAvailable < targetNode.server.moneyMax) {
			logger.warn(
				LogType.log,
				batch,
				'Encountering money drift %s < %s',
				ns.nFormat(targetNode.server.moneyAvailable, enums.Format.money),
				ns.nFormat(targetNode.server.moneyMax, enums.Format.money)
			)
			toaster.warn('Encountering money drift', targetNode.server.hostname)
		}

		if (targetNode.server.hackDifficulty > targetNode.server.baseDifficulty) {
			logger.warn(
				LogType.log,
				batch,
				'Encountering security drift %s > %s',
				ns.nFormat(targetNode.server.hackDifficulty, enums.Format.security),
				ns.nFormat(targetNode.server.minDifficulty, enums.Format.security)
			)
			toaster.warn('Encountering security drift', targetNode.server.hostname)
		}

		batch++
	}
}
