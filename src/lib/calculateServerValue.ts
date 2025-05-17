import {HGWFormulasCalculator} from '/lib/HGWFormulasCalculator'
import * as enums from '/lib/enums'

export function calculateServerValue(calculator: HGWFormulasCalculator, weightMPS = 1, weightEPS = 1, weightTU = 1): number {
	const threadCost = calculator.calculateTotalThreads() * weightTU
	const valueMoney = calculator.calculateMoneyPerSecond() * weightMPS
	const eps = calculator.calculateExpPerSecond()
	const valueExp = eps * enums.MoneyValue.exp * weightEPS
	return (valueMoney + valueExp) / threadCost
}
