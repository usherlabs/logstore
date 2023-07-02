import {
	IReportV1,
	ReportSerializerVersions,
	SystemReport,
} from '@logsn/protocol';
import { BigNumber } from 'ethers';

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
			nodes[nodeKey] = BigNumber.from(source.nodes[nodeKey].round().toHex());
		}
		for (const delegateKey of Object.keys(source.delegates)) {
			delegates[delegateKey] = {};
			for (const nodeKey of Object.keys(source.delegates[delegateKey])) {
				delegates[delegateKey][nodeKey] = BigNumber.from(
					source.delegates[delegateKey][nodeKey].round().toHex()
				);
			}
		}

		const finalReport: IReportV1 = {
			s: false,
			v: ReportSerializerVersions.V1,
			id: source.id,
			height: source.height,
			treasury: BigNumber.from(source.treasury.round().toHex()),
			streams: source.streams.map((v) => ({
				...v,
				capture: BigNumber.from(v.capture.round().toHex()),
			})),
			consumers: source.consumers.map((v) => ({
				...v,
				capture: BigNumber.from(v.capture.round().toHex()),
			})),
			nodes,
			delegates,
			events: source.events,
		};

		return new SystemReport(finalReport, ReportSerializerVersions.V1);
	}
}
