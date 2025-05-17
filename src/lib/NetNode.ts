import {NS} from '@ns'

export function getNetTree(ns: NS, origin = 'home', maxDepth = -1): NetNode {
	return buildNetNode(ns, origin, origin, 0, maxDepth)
}

export function getNetNode(ns: NS, hostname: string): NetNode {
	return getNetTree(ns, hostname, 0)
}

export function getNetNodes(ns: NS, origin = 'home', maxDepth = -1): NetNode[] {
	return getNetTree(ns, origin, maxDepth).flat()
}

function buildNetNode(ns: NS, parent: string, current: string, depth: number, maxDepth: number): NetNode {
	const children = ns.scan(current).filter((hostname) => hostname != parent)
	if (children.length > 0 && (maxDepth === -1 || depth < maxDepth)) {
		const childNodes: NetNode[] = children.map((child) => buildNetNode(ns, current, child, depth + 1, maxDepth))
		const parentNode = new NetNode(ns, current, childNodes, depth, parent === current)
		childNodes.forEach((node) => (node.parent = parentNode))
		return parentNode
	} else {
		return new NetNode(ns, current, [], depth, parent === current)
	}
}

export class NetNode {
	private readonly _ns: NS

	readonly hostname: string
	parent?: NetNode
	readonly children: NetNode[]
	readonly depth: number
	readonly netRoot: boolean

	constructor(ns: NS, hostname: string, children: NetNode[], depth: number, netRoot: boolean) {
		this._ns = ns

		this.hostname = hostname

		this.children = children
		this.depth = depth
		this.netRoot = netRoot
	}

	flat(): NetNode[] {
		if (this.children.length > 0) {
			const children = this.children.map((child) => child.flat()).flat()
			children.unshift(this)
			return children
		} else {
			return [this]
		}
	}

	searchPathUp(destinationHostname: string): NetNode[] {
		if (this.hostname === destinationHostname) {
			return [this]
		} else if (this.parent !== undefined) {
			const path = this.parent?.searchPathUp(destinationHostname)
			path.push(this)
			return path
		} else {
			// we are at root
			throw new Error('searchPathDown not implemented yet')
		}
	}
}
