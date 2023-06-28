import { BigNumber } from '@ethersproject/bignumber';
import { ReportSerializer } from '../abstracts/ReportSerializer';
import { ReportContractParamsBase } from '../interfaces/report.common';
import { IReportV1, IReportV1Serialized, ReportV1DelegatesSerialized, ReportV1NodesSerialized } from '../interfaces/report.v1';
import { ReportSerializerVersions } from './ReportSerializerVersions';
import { SystemReport } from './SystemReport';

import * as hexUtils from '../utils/hex';

export class ReportSeralizerV1 extends ReportSerializer {
	serialize(payload: IReportV1): IReportV1Serialized {
		const nodes: ReportV1NodesSerialized = {};
		Object.entries(payload.nodes).forEach(([address, value]) => {
			nodes[address] = hexUtils.numToHex(value)
		})

		const delegates: ReportV1DelegatesSerialized = {};
		Object.entries(payload.delegates).forEach(([delAddress, records]) => {
			Object.entries(records).forEach(([nodeAddress, value]) => {
				delegates[delAddress][nodeAddress] = hexUtils.numToHex(value)
			})
		})

		let events;
		if(payload.events){
			events = {
				queries: payload.events.queries.map(p => ({
					...p,
					id: hexUtils.strToHex(p.id)
				})),
				storage: payload.events.queries.map(p => ({
					...p,
					id: hexUtils.strToHex(p.id)
				}))
			};
			payload.events.
		}

		return {
			s: true,
			v: ReportSerializerVersions.V1,
			id: payload.id,
			height: payload.height,
			treasury: hexUtils.numToHex(payload.treasury),
			streams: payload.streams.map(p => ({
				...p,
				id: hexUtils.strToHex(p.id),
				capture: hexUtils.numToHex(p.capture)
			})),
			consumers: payload.consumers.map(p => ({
				...p,
				capture: hexUtils.numToHex(p.capture)
			})),
			nodes: nodes,
			delegates,
			events
		}
	}

	deserialize(payload: IReportV1Serialized): IReport {

	}

	toJSON(payload: IReportV1 | IReportV1Serialized): string {
		return JSON.stringify(payload);
	}

	toContract(
		payload: IReportV1 | IReportV1Serialized
	): ReportContractParamsBase {
		let report = payload as IReportV1;
		if (payload.s === true) {
			report = this.deserialize(payload as IReportV1Serialized);
		}

		const streams = report.streams.map(({ id }) => id);
		const writeCaptureAmounts = report.streams.map(({ capture }) => BigInt(capture));
		const writeBytes = report.streams.map(({ bytes }) => bytes);
		const readConsumerAddresses =  report.consumers.map(({ id }) => id);
		const readCaptureAmounts = report.consumers.map(({ capture }) => BigInt(capture));
		const readBytes = report.consumers.map(({ bytes }) => bytes);
		const nodes = Object.keys(report.nodes);
		const nodeChanges = Object.values(report.nodes).map(v => BigInt(v));
		const delegates = Object.keys(report.delegates);
		const delegateNodes = Object.keys(report.delegates).map((delegate) =>
		Object.keys(report.delegates[delegate])
	)
	const delegateNodeChanges = Object.keys(report.delegates).map((delegate) =>
	Object.values(report.delegates[delegate])
)
const treasurySupplyChange = BigInt(report.treasury)

		const params = [
			report.id,
			report.height,
			streams,
			writeCaptureAmounts,
			writeBytes,
			readConsumerAddresses,
			readCaptureAmounts,
			readBytes,
			nodes,
			nodeChanges,
			delegates,
			delegateNodes,
			delegateNodeChanges,
			treasurySupplyChange,
		];

		return params;
	}
}

SystemReport.registerSerializer(ReportSerializerVersions.V1, ReportSeralizerV1);
