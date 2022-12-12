import {NS, SkillsFormulas} from '@ns'

export function findExpCost(ns: NS, targetSkillLevel: number): number {
	const hackingExpMultiplier = ns.getPlayer().mults.hacking_exp * ns.getBitNodeMultipliers().HackExpGain
	const hackingSkillMultiplier = ns.getPlayer().mults.hacking * ns.getBitNodeMultipliers().HackingLevelMultiplier
	const formulas = ns.formulas.skills
	if (targetSkillLevel === 0) {
		return 0
	}

	const exp = formulas.calculateExp(targetSkillLevel, hackingExpMultiplier)

	return binarySearch(formulas, hackingSkillMultiplier, targetSkillLevel, 0, exp)
}

function binarySearch(formulas: SkillsFormulas, hackingSkillMultiplier: number, targetSkillLevel: number, low: number, high: number): number {
	if (low > high) {
		throw new Error('low is bigger then high')
	}

	const mid = (low + high) / 2
	const midLevel = formulas.calculateSkill(mid, hackingSkillMultiplier)
	if (targetSkillLevel === midLevel) {
		return mid
	}
	if (targetSkillLevel > midLevel) {
		return binarySearch(formulas, hackingSkillMultiplier, targetSkillLevel, mid + 1, high)
	}
	return binarySearch(formulas, hackingSkillMultiplier, targetSkillLevel, low, mid - 1)
}
