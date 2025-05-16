import {AutocompleteData, InfiltrationLocation, NS} from '@ns'
import {Logger} from '/lib/logging/Logger'
import {ArgsSchema} from '/lib/ArgsSchema'
import * as enums from '/lib/enums'
import {Formatter} from "/lib/logging/Formatter";

const difficultyMap: Record<string, number> = {
	easy: 1,
	medium: 2,
	hard: 3,
}

// TODO test this

enum Args {
	difficulty = 'difficulty',
}

const argsSchema = [
	[Args.difficulty, 'medium'],
	[enums.CommonArgs.sort, 'rep'],
	[enums.CommonArgs.limit, 5],
] as ArgsSchema

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	data.flags(argsSchema)
	return [];
}

export async function main(ns: NS): Promise<void> {
	const formatter = new Formatter(ns)
	const logger = new Logger(ns)

	const args = ns.flags(argsSchema)
	const difficulty = (args[Args.difficulty] as string).toLowerCase()
	const sort = (args[enums.CommonArgs.sort] as string).toLowerCase()
	const limit = args[enums.CommonArgs.limit] as number

	let infiltrations = ns.infiltration
		.getPossibleLocations()
		.map((location) => ns.infiltration.getInfiltration(location.name))

	if (difficulty != 'impossible') {
		const maxDifficulty = difficultyMap[difficulty]
		if (maxDifficulty !== undefined) {
			infiltrations = infiltrations.filter(
				(infiltration) => infiltration['difficulty'] < maxDifficulty
			)
		}
	}

	switch (sort) {
		case 'rep':
			infiltrations = infiltrations.sort(
				(a, b) => b.reward.tradeRep - a.reward.tradeRep
			)
			break
		case 'soa':
			infiltrations = infiltrations.sort(
				(a, b) => b.reward.SoARep - a.reward.SoARep
			)
			break
		case 'money':
			infiltrations = infiltrations.sort(
				(a, b) => b.reward.sellCash - a.reward.sellCash
			)
			break
		case 'difficulty':
			infiltrations = infiltrations
				.sort((a, b) => {
					const aInfiltrationData = extractInfiltrationData(a)
					const bInfiltrationData = extractInfiltrationData(b)
					return (
						bInfiltrationData['maxClearanceLevel'] -
						aInfiltrationData['maxClearanceLevel']
					)
				})
				.sort((a, b) => b.difficulty - a.difficulty)
			break
	}

	logger.print()
		.terminal()
		.print('~~~~~~~~~~ Beginning infiltrations ~~~~~~~~~~')
	logger.print()
		.terminal()
		.print(' ')
	for (let i = 0; i < limit; i++) {
		const infiltration = infiltrations[i]
		const infiltrationData = extractInfiltrationData(infiltration)
		logger.print()
			.terminal()
			.withFormat('%s -> %s')
			.print(infiltration.location.city, infiltration.location.name)
		logger.print()
			.terminal()
			.withFormat('Difficulty: %s, Level: %s')
			.print(determineDifficulty(infiltration.difficulty), infiltrationData['maxClearanceLevel'])
		logger.print()
			.terminal()
			.withFormat('Reward: %s or %s rep / SoA %s rep')
			.print(formatter.money(infiltration.reward.sellCash),
				formatter.rep(infiltration.reward.tradeRep),
				formatter.rep(infiltration.reward.SoARep))
		logger.print()
			.terminal()
			.print(' ')
	}
}

function determineDifficulty(difficulty: number): string {
	if (difficulty < 1) {
		return 'Easy'
	} else if (difficulty < 2) {
		return 'Medium'
	} else if (difficulty < 3) {
		return 'Hard'
	} else {
		return 'Impossible'
	}
}

function extractInfiltrationData(
	infiltration: InfiltrationLocation
): Record<string, number> {
	return (infiltration.location as unknown as Record<string, unknown>)[
		'infiltrationData'
		] as Record<string, number>
}
