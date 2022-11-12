import {AutocompleteData, InfiltrationLocation, NS} from '@ns'
import {Logger, LogType} from 'lib/logging/Logger'
import * as enums from 'lib/enums'

const difficultyMap: Record<string, number> = {
	easy: 1,
	medium: 2,
	hard: 3,
}

// TODO test this

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data: AutocompleteData, args: string[]): unknown {
	return ['--difficulty', '--sort', '--limit'];
}

export async function main(ns: NS): Promise<void> {
	const logger = new Logger(ns)

	const args = ns.flags([
		['difficulty', 'medium'],
		['sort', 'rep'],
		['limit', 5],
	])
	const difficulty = (args['difficulty'] as string).toLowerCase()
	const sort = (args['sort'] as string).toLowerCase()
	const limit = args['limit'] as number

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

	logger.print(
		LogType.terminal,
		'~~~~~~~~~~ Beginning infiltrations ~~~~~~~~~~'
	)
	logger.print(LogType.terminal, ' ')
	for (let i = 0; i < limit; i++) {
		const infiltration = infiltrations[i]
		const infiltrationData = extractInfiltrationData(infiltration)
		logger.print(
			LogType.terminal,
			'%s -> %s',
			infiltration.location.city,
			infiltration.location.name
		)
		logger.print(
			LogType.terminal,
			'Difficulty: %s, Level: %s',
			determineDifficulty(infiltration.difficulty),
			infiltrationData['maxClearanceLevel']
		)
		logger.print(
			LogType.terminal,
			'Reward: %s or %s rep / SoA %s rep',
			ns.nFormat(infiltration.reward.sellCash, enums.Format.money),
			ns.nFormat(infiltration.reward.tradeRep, enums.Format.rep),
			ns.nFormat(infiltration.reward.SoARep, enums.Format.rep)
		)
		logger.print(LogType.terminal, ' ')
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
