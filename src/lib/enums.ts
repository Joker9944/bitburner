export enum PortBreakerFiles {
	brutessh = 'BruteSSH.exe',
	ftpcrack = 'FTPCrack.exe',
	relaysmtp = 'relaySMTP.exe',
	httpworm = 'HTTPWorm.exe',
	sqlinject = 'SQLInject.exe',
}

export enum CommonArgs {
	maxHackPercentage = 'max-hack-percentage',
	maxThreads = 'max-threads',
	maxDepth = 'max-depth',
	watch = 'watch',
	sort = 'sort',
	limit = 'limit',
	positional = '_',
}

export enum Commands {
	shack = '/commands/shack.js',
	fluffer = '/commands/fluffer.js',
}

export enum DaemonScripts {
	portCleanupDaemon = '/daemons/PortCleanupDaemon.js',
	cnCBroadcasterDaemon = '/daemons/cnc/CnCBroadcasterDaemon.js',
	r00terDaemon = '/daemons/R00terDaemon.js',
	ramManagerDaemon = '/daemons/ram/RamManagerDaemon.js',
	backd00rDaemon = '/daemons/Backd00rDaemon.js',
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

export enum BackdoorPropertyServers {
	csec = 'CSEC',
	niteSec = 'avmnite-02h',
	theBlackHand = 'I.I.I.I',
	bitRunners = 'run4theh111z',
	bitNode = 'w0r1d_d43m0n',
}

// multipliers to convert value to money
export enum MoneyValue {
	exp = 40
}
