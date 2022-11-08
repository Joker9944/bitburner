export enum PortBreakerFiles {
	brutessh = 'BruteSSH.exe',
	ftpcrack = 'FTPCrack.exe',
	relaysmtp = 'relaySMTP.exe',
	httpworm = 'HTTPWorm.exe',
	sqlinject = 'SQLInject.exe',
}

export enum ProgramFiles {
	formulas = 'Formulas.exe',
}

export enum Commands {
	shack = '/commands/shack.js',
	fluffer = '/commands/fluffer.js',
}

export enum DaemonScripts {
	r00terDaemon = '/daemons/R00terDaemon.js',
	ramManagerDaemon = '/daemons/RamManagerDaemon.js',
}

export enum BatcherScripts {
	fluffer = '/bin/Fluffer.js',
	batcher = '/bin/Batcher.js',
}

export enum LaunchpadScripts {
	hack = '/launchpad/hack.js',
	grow = '/launchpad/grow.js',
	weaken = '/launchpad/weaken.js',
}

export enum Security {
	hackIncrease = 0.002,
	growIncrease = 0.004,
}

export enum Format {
	security = '0.[000]',
	money = '$0.000a',
	ram = '0.00b',
	percentage = '0.00%',
	rep = '0.000a',
}

export const reservedRam = {
	home: 30000,
} as Record<string, number>

export enum ScriptCost {
	launchpadScripts = 1750,
}

export enum PortIndex {
	ramMessaging = 1,
	cncBroadcasting = 2,
	cncMessaging = 3,
}

export enum PortCleanup {
	ramManager = PortIndex.ramMessaging,
	cncMessaging = PortIndex.cncMessaging
}

export const hackingFactionServers = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	'CSEC': 'CyberSec',
	'avmnite-02h': 'NiteSec',
	// eslint-disable-next-line @typescript-eslint/naming-convention
	'I.I.I.I': 'The Black Hand',
	'run4theh111z': 'BitRunners',
} as Record<string, string>
