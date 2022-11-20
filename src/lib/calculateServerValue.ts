import {HGWFormulasCalculator} from "/lib/HGWFormulasCalculator"

export function calculateServerValue(calculator: HGWFormulasCalculator, weightMPS = 1, weightEPS = 1, weightTUPS = 1): number {
	const valueTUPS = calculator.calculateTUPS() * weightTUPS
	const valueMPS = calculator.calculateMPS() * weightMPS
	const valueEPS = calculator.calculateEPS() * weightEPS
	return valueMPS / valueTUPS + valueEPS / valueTUPS
}
