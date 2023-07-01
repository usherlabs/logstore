import {
	IReportV1Serialized,
	ReportSerializerVersions,
	SystemReport,
} from '@logsn/protocol';

import { IValidatorReport } from '../types';

export class ReportUtils {
	static sort(source: IValidatorReport): IValidatorReport {
		const result: IValidatorReport = {
			...source,
			nodes: {},
			delegates: {},
			streams: source.streams.sort((a, b) => a.id.localeCompare(b.id)),
			consumers: source.consumers.sort((a, b) => a.id.localeCompare(b.id)),
			events: {
				queries: source.events.queries.sort((a, b) =>
					a.hash.localeCompare(b.hash)
				),
				storage: source.events.storage.sort((a, b) =>
					a.hash.localeCompare(b.hash)
				),
			},
		};

		const nodeKeys = Object.keys(source.nodes).sort((a, b) =>
			a.localeCompare(b)
		);
		for (const key of nodeKeys) {
			result.nodes[key] = source.nodes[key];
		}

		const delegateKeys = Object.keys(source.delegates).sort((a, b) =>
			a.localeCompare(b)
		);
		for (const key of delegateKeys) {
			result.delegates[key] = source.delegates[key];
		}

		return result;
	}

	static finalise(source: IValidatorReport): SystemReport {
		const nodes = {};
		const delegates = {};
		for (const nodeKey of Object.keys(source.nodes)) {
			nodes[nodeKey] = source.nodes[nodeKey].round().toHex();
		}
		for (const delegateKey of Object.keys(source.delegates)) {
			delegates[delegateKey] = {};
			for (const nodeKey of Object.keys(source.delegates[delegateKey])) {
				delegates[delegateKey][nodeKey] = source.delegates[delegateKey][nodeKey]
					.round()
					.toHex();
			}
		}

		const finalReport: IReportV1Serialized = {
			s: true,
			v: ReportSerializerVersions.V1,
			id: source.id,
			height: source.height,
			treasury: source.treasury.round().toHex(),
			streams: source.streams.map((v) => ({
				...v,
				capture: v.capture.round().toHex(),
			})),
			consumers: source.consumers.map((v) => ({
				...v,
				capture: v.capture.round().toHex(),
			})),
			nodes,
			delegates,
			events: source.events,
		};

		return new SystemReport(finalReport, ReportSerializerVersions.V1);
	}
}
