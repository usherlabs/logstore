import { LogStoreReportManager } from '@logsn/contracts';
import {
	IReportV1,
	ReportSerializerVersions,
	SystemReport,
} from '@logsn/protocol';

export class ReportManager {
	constructor(private _contract: LogStoreReportManager) {}

	public get contract() {
		return this._contract;
	}

	async getLastReport(): Promise<SystemReport> {
		const r = await this.contract.getLastReport();

		const nodes = {};
		r.nodes.forEach((n) => {
			nodes[n.id.toString()] = n.amount;
		});
		const delegates = {};
		r.delegates.forEach((d) => {
			const dNodes = {};
			d.nodes.forEach((n) => {
				dNodes[n.id.toString()] = n.amount;
			});
			delegates[d.id.toString()] = dNodes;
		});

		const report: IReportV1 = {
			s: false,
			v: ReportSerializerVersions.V1,
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

		return new SystemReport(report);
	}
}
