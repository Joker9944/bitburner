import { NS } from '@ns'
import { Logger, LogType } from 'lib/logging/Logger'
import { calculateMaxThreadCount } from 'lib/calculateMaxThreadCount'
import * as enums from 'lib/enums'

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	const args = ns.flags([['free', false]])
	const free = args['free'] as boolean
	const threadRamCost = (
		(args['_'] as string[]).length === 0 ? enums.ScriptCost.launchpadScripts : (args['_'] as string[])[0]
	) as number

	const maxThreadsPerServer = calculateMaxThreadCount(ns, threadRamCost, free)

	Object.entries(maxThreadsPerServer).forEach((entry) =>
		logger.print(LogType.terminal, '%s -> %s', entry[0], entry[1])
	)
	logger.print(LogType.terminal, '======')
	logger.print(
		LogType.terminal,
		'Total -> %s',
		Object.values(maxThreadsPerServer).reduce((a, b) => a + b)
	)
}
