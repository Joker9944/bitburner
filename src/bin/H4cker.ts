import {AutocompleteData, NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {getNetNode} from '/lib/NetNode'
import * as fluffer from '/bin/Fluffer'
import * as batcher from '/bin/Batcher'
import {positionalArgument} from '/lib/positionalArgument'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(batcher.argsSchema)
	return [...data.servers]
}

export async function main(ns: NS): Promise<void> {
	ns.disableLog('ALL')

	const logger = new Logger(ns)

	const args = ns.flags([])
	const targetServer = ns.getServer(positionalArgument(args, 0, 'n00dles') as string)
	if (targetServer.hackDifficulty! > targetServer.minDifficulty! || targetServer.moneyAvailable! < targetServer.moneyMax!) {
		logger.info()
			.withIdentifier(targetServer.hostname)
			.print('Fluffing')
		logger.info()
			.terminal()
			.withIdentifier(targetServer.hostname)
			.print('Fluffing')
		await fluffer.main(ns)
	}
	logger.info()
		.withIdentifier(targetServer.hostname)
		.print('Batching')
	logger.info()
		.terminal()
		.withIdentifier(targetServer.hostname)
		.print('Batching')
	await batcher.main(ns)
}
