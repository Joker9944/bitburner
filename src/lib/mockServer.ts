import {Server} from "@ns";


export function mockServer(original: Server): Server {
	return {...original}
}

export function mockMaxServer(original: Server): Server {
	const mock = mockServer(original)
	mock.moneyAvailable = original.moneyMax
	mock.hackDifficulty = original.minDifficulty
	return mock
}
