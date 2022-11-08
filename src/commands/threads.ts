import {NS} from '@ns'
import {Logger, LogType} from '/lib/logging/Logger'
import {createRamClient} from '/daemons/ram/IpcRamClient'

const identifier = 'command-threads'

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	const client = createRamClient(ns, identifier)
	const data = await client.lookupThreads()

	const dataEntries = Object.entries(data)

	if (dataEntries.length === 0) {
		logger.print(LogType.terminal, 'No threads available')
		return
	}

	dataEntries.forEach((entry) =>
		logger.print(LogType.terminal, '%s -> %s', entry[0], entry[1])
	)
	logger.print(LogType.terminal, '======')
	logger.print(
		LogType.terminal,
		'Total -> %s',
		Object.values(data).reduce((a, b) => a + b)
	)
}
