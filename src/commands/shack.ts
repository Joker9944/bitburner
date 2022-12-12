import {AutocompleteData, NS} from '@ns'
import {getNetNode} from '/lib/NetNode'
import {Logger} from '/lib/logging/Logger'
import {runningHackingScripts} from '/lib/runningHackingScripts'
import {ArgsSchema} from '/lib/ArgsSchema'
import * as enums from '/lib/enums'

const argsSchema = [
	[enums.CommonArgs.maxHackPercentage, -1],
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return [...data.servers];
}

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const logger = new Logger(ns)

	const args = ns.flags(argsSchema)
	const maxHackPercentage = args[enums.CommonArgs.maxHackPercentage] as number

	if (maxHackPercentage !== -1 && maxHackPercentage <= 0 && maxHackPercentage > 1) {
		logger.error()
			.terminal()
			.withFormat('Hack percentage %s is invalid')
			.print(maxHackPercentage)
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
		logger.info()
			.terminal()
			.withIdentifier(targetNode.server.hostname)
			.print('Server is already being batched')
		return
	}

	await runningHackingScripts(ns, targetNode.server.hostname)

	if (targetNode.server.hackDifficulty > targetNode.server.minDifficulty ||
		targetNode.server.moneyAvailable < targetNode.server.moneyMax) {
		logger.info()
			.withIdentifier(targetNode.server.hostname)
			.print('Fluffing')
		logger.info()
			.terminal()
			.withIdentifier(targetNode.server.hostname)
			.print('Fluffing')
		ns.exec(enums.BatcherScripts.fluffer, execNode.server.hostname, 1, targetNode.server.hostname)
		while (ns.isRunning(enums.BatcherScripts.fluffer, execNode.server.hostname, targetNode.server.hostname)) {
			await ns.sleep(1000)
		}
	}

	const batcherArgs = [targetNode.server.hostname]
	if (maxHackPercentage !== -1) {
		batcherArgs.unshift('--max-hack-percentage', String(maxHackPercentage))
	}

	logger.info()
		.withIdentifier(targetNode.server.hostname)
		.print('Spawning batcher')
	logger.info()
		.terminal()
		.withIdentifier(targetNode.server.hostname)
		.print('Spawning batcher')
	ns.spawn(enums.BatcherScripts.batcher, 1, ...batcherArgs)
}
