import {NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {createRamClient} from '/daemons/ram/IpcRamClient'

const identifier = 'command-threads'

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	const client = createRamClient(ns, identifier)
	const data = await client.lookupThreads()

	const dataEntries = Object.entries(data)

	if (dataEntries.length === 0) {
		logger.print()
			.terminal()
			.print('No threads available')
		return
	}

	dataEntries.forEach((entry) =>
		logger.print()
			.terminal()
			.withFormat('%s -> %s')
			.print(entry[0], entry[1])
	)
	logger.print()
		.terminal()
		.print('======')
	logger.print()
		.terminal()
		.withFormat('Total -> %s')
		.print(Object.values(data).reduce((a, b) => a + b))
}
