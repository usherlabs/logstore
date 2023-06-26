import { LogStoreReportManager } from '@logsn/contracts';

import { IReport } from '../types';

export class ReportManager {
	constructor(private _contract: LogStoreReportManager) {}

	public get contract() {
		return this._contract;
	}

	async getLastReport() {
		const r = await this.contract.getLastReport();

		const nodes = {};
		r.nodes.forEach((n) => {
			nodes[n.id.toString()] = n.amount.toNumber();
		});
		const delegates = {};
		r.delegates.forEach((d) => {
			const dNodes = {};
			d.nodes.forEach((n) => {
				dNodes[n.id.toString()] = n.amount.toNumber();
			});
			delegates[d.id.toString()] = dNodes;
		});

		const report: IReport = {
			id: r.id,
			height: r.height.toNumber(),
			treasury: r.treasury,
			streams: r.streams.map((s) => ({
				id: s.id.toString(),
				capture: s.writeCapture,
				bytes: s.writeBytes.toNumber(),
			})),
			consumers: r.consumers.map((c) => ({
				id: c.id.toString(),
				capture: c.readCapture,
				bytes: c.readBytes.toNumber(),
			})),
			nodes,
			delegates,
		};

		return report;
	}
}
