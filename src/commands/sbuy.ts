import {AutocompleteData, NS} from "@ns";
import * as enums from '/lib/enums'
import {ArgsSchema} from "/lib/ArgsSchema";
import {Logger} from "/lib/logging/Logger";

enum Args {
	all = 'all',
}

export const argsSchema = [
	[Args.all, false]
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return [...Object.values(enums.PortBreakerFiles)]
}

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	if (!ns.singularity.purchaseTor()) {
		logger.error()
			.terminal()
			.print('Could not buy TOR router')
		return
	}

	shoppingList(ns).forEach(portBreaker => {
		if (ns.fileExists(portBreaker)) {
			logger.info()
				.terminal()
				.withFormat('Already bought %s')
				.print(portBreaker)
		} else {
			if (ns.singularity.purchaseProgram(portBreaker)) {
				logger.success()
					.terminal()
					.withFormat('Successfully bought %s')
					.print(portBreaker)
			} else {
				logger.error()
					.terminal()
					.withFormat('Failed to buy %s')
					.print(portBreaker)
			}
		}
	})
}

function shoppingList(ns: NS): enums.PortBreakerFiles[] {
	const args = ns.flags(argsSchema)
	if (args[Args.all] as boolean) {
		return Object.values(enums.PortBreakerFiles)
	} else {
		return args[enums.CommonArgs.positional] as enums.PortBreakerFiles[]
	}
}
