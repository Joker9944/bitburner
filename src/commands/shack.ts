import { NS } from '@ns'
import { getNetNode } from 'lib/NetNode'
import { Logger, LogType } from 'lib/logging/Logger'
import { runningHackingScripts } from 'lib/runningHackingScripts'
import * as enums from 'lib/enums'

const knownBestValues: Record<string, Record<string, string>> = {
	n00dles: {
		growCount: '30',
		growIncrease: '10',
	},
}

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const logger = new Logger(ns)

	const args = ns.flags([
		['max-threads', 0],
		['hack-percentage', -1],
	])
	const maxThreads = args['max-threads'] as number
	const hackPercentage = args['hack-percentage'] as number

	if (hackPercentage !== -1 && hackPercentage <= 0 && hackPercentage > 1) {
		logger.error(LogType.terminal, 'Hack percentage %s is invalid', hackPercentage)
		return
	}

	const targetServerHostname = (args['_'] as string[]).length === 0 ? 'n00dles' : (args['_'] as string[])[0]
	const targetNode = getNetNode(ns, targetServerHostname)

	const execNode = getNetNode(ns, ns.getHostname())

	const batcherRunning =
		ns.ps(execNode.server.hostname).filter((script) => {
			return (
				script.filename == enums.DaemonScripts.formulasBatcher &&
				script.args.includes(targetNode.server.hostname)
			)
		}).length > 0

	if (batcherRunning) {
		logger.info(LogType.terminal, 'Server %s is already being shacked', targetNode.server.hostname)
		return
	}

	await runningHackingScripts(ns, execNode.server.hostname, targetNode.server.hostname)

	const formulas = ns.fileExists(enums.ProgramFiles.formulas)

	const flufferArgs = ['--max-threads', maxThreads, targetNode.server.hostname]

	if (
		targetNode.server.hackDifficulty > targetNode.server.minDifficulty ||
		targetNode.server.moneyAvailable < targetNode.server.moneyMax
	) {
		logger.info(LogType.log, 'Fluffing %s', targetNode.server.hostname)
		logger.info(LogType.terminal, 'Fluffing %s', targetNode.server.hostname)
		ns.exec(enums.Commands.fluffer, execNode.server.hostname, 1, ...flufferArgs)
		while (ns.isRunning(enums.Commands.fluffer, execNode.server.hostname, ...flufferArgs)) {
			await ns.sleep(1000)
		}
	}

	const batcherArgs = ['--max-threads', maxThreads, targetNode.server.hostname]
	if (hackPercentage !== -1) {
		batcherArgs.unshift('--hack-percentage', hackPercentage.toString())
	}

	if (formulas) {
		logger.info(LogType.log, 'Spawning formulas batcher targeting %s', targetNode.server.hostname)
		logger.info(LogType.terminal, 'Spawning formulas batcher targeting %s', targetNode.server.hostname)
		ns.spawn(enums.DaemonScripts.formulasBatcher, 1, ...batcherArgs)
	} else {
		const bestValues = knownBestValues[targetNode.server.hostname]
		if (bestValues === undefined) {
			logger.info(
				LogType.log,
				'Spawning simple batcher without known best values targeting %s',
				targetNode.server.hostname
			)
			logger.info(
				LogType.terminal,
				'Spawning simple batcher without known best values targeting %s',
				targetNode.server.hostname
			)
		} else {
			batcherArgs.unshift('--grow-count', bestValues.growCount, '--grow-increse', bestValues.growIncrease)
			logger.info(
				LogType.log,
				'Spawning simple batcher with known best values %s targeting %s',
				bestValues,
				targetNode.server.hostname
			)
			logger.info(
				LogType.terminal,
				'Spawning simple batcher with known best values %s targeting %s',
				bestValues,
				targetNode.server.hostname
			)
		}
		ns.spawn(enums.DaemonScripts.simpleBatcher, 1, ...batcherArgs)
	}
}
