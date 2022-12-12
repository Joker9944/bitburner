import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import * as enums from '/lib/enums'

export function calculateServerValue(calculator: HGWFormulasCalculator, weightMPS = 1, weightEPS = 1, weightTU = 1): number {
	const threadCost = calculator.calculateTU() * weightTU
	const valueMoney = calculator.calculateMPS() * weightMPS
	const eps = calculator.calculateEPS()
	const valueExp = eps * enums.MoneyValue.exp * weightEPS
	return (valueMoney + valueExp) / threadCost
}
