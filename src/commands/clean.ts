import {NS} from "@ns";

export async function main(ns: NS): Promise<void> {
	ns.ls('home', '.js')
		.filter(script => script !== '/commands/clean.js')
		.forEach(script => ns.rm(script, 'home'))
}
