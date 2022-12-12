import {ScriptArg} from '@ns'
import * as enums from '/lib/enums'

export function positionalArgument(args: { [key: string]: ScriptArg | string[] }, position: number, defaultValue?: unknown): unknown {
	const arg = (args[enums.CommonArgs.positional] as string[])[position]
	if (arg === undefined && defaultValue !== undefined) {
		return defaultValue
	}
	return arg
}
