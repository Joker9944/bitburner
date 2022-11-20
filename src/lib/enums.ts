export enum PortBreakerFiles {
	brutessh = 'BruteSSH.exe',
	ftpcrack = 'FTPCrack.exe',
	relaysmtp = 'relaySMTP.exe',
	httpworm = 'HTTPWorm.exe',
	sqlinject = 'SQLInject.exe',
}

export enum PortBreakerFilesCost {
	tor = 200000,
	brutessh = 'BruteSSH.exe',
	ftpcrack = 'FTPCrack.exe',
	relaysmtp = 'relaySMTP.exe',
	httpworm = 'HTTPWorm.exe',
	sqlinject = 'SQLInject.exe',
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
	exp = '0.000a',
	threads = '0.00a',
	serverValue = '0.00a',
}

export enum ScriptCost {
	hack = 1700,
	grow = 1750,
	weaken = 1750,
}

export enum PortIndex {
	ramMessagingClientIn = 1,
	ramMessagingServerIn = 2,
	cncBroadcasting = 3,
	cncMessaging = 4,
}

export enum PortCleanup {
	ramMessagingClientIn = PortIndex.ramMessagingClientIn,
	ramMessagingServerIn = PortIndex.ramMessagingServerIn,
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
