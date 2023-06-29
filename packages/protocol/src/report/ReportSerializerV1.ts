import { BigNumber } from '@ethersproject/bignumber';

import { ReportSerializer } from '../abstracts/ReportSerializer';
import {
	ReportContractParams,
	ReportSerializerVersions,
} from '../interfaces/report.common';
import {
	IReportV1,
	IReportV1Serialized,
	ReportV1Delegates,
	ReportV1DelegatesSerialized,
	ReportV1Nodes,
	ReportV1NodesSerialized,
} from '../interfaces/report.v1';
import * as hexUtils from '../utils/hex';
import { SystemReport } from './SystemReport';

export class ReportSeralizerV1 extends ReportSerializer {
	serialize(payload: IReportV1): IReportV1Serialized {
		const nodes: ReportV1NodesSerialized = {};
		Object.entries(payload.nodes).forEach(([address, value]) => {
			nodes[address] = BigNumber.from(value).toHexString();
		});

		const delegates: ReportV1DelegatesSerialized = {};
		Object.entries(payload.delegates).forEach(([delAddress, records]) => {
			if (typeof delegates[delAddress] === 'undefined') {
				delegates[delAddress] = {};
			}
			Object.entries(records).forEach(([nodeAddress, value]) => {
				delegates[delAddress][nodeAddress] =
					BigNumber.from(value).toHexString();
			});
		});

		let events;
		if (payload.events) {
			events = {
				queries: payload.events.queries,
				storage: payload.events.storage.map((p) => ({
					...p,
					id: hexUtils.strToHex(p.id),
				})),
			};
		}

		return {
			s: true,
			v: ReportSerializerVersions.V1,
			id: payload.id,
			height: payload.height,
			treasury: BigNumber.from(payload.treasury).toHexString(),
			streams: payload.streams.map((p) => ({
				...p,
				id: hexUtils.strToHex(p.id),
				capture: BigNumber.from(p.capture).toHexString(),
			})),
			consumers: payload.consumers.map((p) => ({
				...p,
				capture: BigNumber.from(p.capture).toHexString(),
			})),
			nodes: nodes,
			delegates,
			events,
		};
	}

	deserialize(payload: IReportV1Serialized): IReportV1 {
		const nodes: ReportV1Nodes = {};
		Object.entries(payload.nodes).forEach(([address, value]) => {
			nodes[address] = BigNumber.from(value);
		});

		const delegates: ReportV1Delegates = {};
		Object.entries(payload.delegates).forEach(([delAddress, records]) => {
			if (typeof delegates[delAddress] === 'undefined') {
				delegates[delAddress] = {};
			}
			Object.entries(records).forEach(([nodeAddress, value]) => {
				delegates[delAddress][nodeAddress] = BigNumber.from(value);
			});
		});

		let events;
		if (payload.events) {
			events = {
				queries: payload.events.queries,
				storage: payload.events.storage.map((p) => ({
					...p,
					id: hexUtils.hexToStr(p.id),
				})),
			};
		}

		return {
			s: false,
			v: ReportSerializerVersions.V1,
			id: payload.id,
			height: payload.height,
			treasury: BigNumber.from(payload.treasury),
			streams: payload.streams.map((p) => ({
				...p,
				id: hexUtils.hexToStr(p.id),
				capture: BigNumber.from(p.capture),
			})),
			consumers: payload.consumers.map((p) => ({
				...p,
				capture: BigNumber.from(p.capture),
			})),
			nodes: nodes,
			delegates,
			events,
		};
	}

	toJSON(payload: IReportV1 | IReportV1Serialized): string {
		let report = payload as IReportV1Serialized;
		if (payload.s !== true) {
			report = this.serialize(payload as IReportV1);
		}

		return JSON.stringify(report);
	}

	toContract(payload: IReportV1 | IReportV1Serialized): ReportContractParams {
		let report = payload as IReportV1;
		if (payload.s === true) {
			report = this.deserialize(payload as IReportV1Serialized);
		}

		const streams = report.streams.map(({ id }) => id);
		const writeCaptureAmounts = report.streams.map(({ capture }) =>
			capture.toBigInt()
		);
		const writeBytes = report.streams.map(({ bytes }) => bytes);
		const readConsumerAddresses = report.consumers.map(({ id }) => id);
		const readCaptureAmounts = report.consumers.map(({ capture }) =>
			capture.toBigInt()
		);
		const readBytes = report.consumers.map(({ bytes }) => bytes);
		const nodes = Object.keys(report.nodes);
		const nodeChanges = Object.values(report.nodes).map((v) => v.toBigInt());
		const delegates = Object.keys(report.delegates);
		const delegateNodes = Object.keys(report.delegates).map((delegate) =>
			Object.keys(report.delegates[delegate])
		);
		const delegateNodeChanges = Object.keys(report.delegates).map((delegate) =>
			Object.values(report.delegates[delegate]).map((v) => v.toBigInt())
		);
		const treasurySupplyChange = report.treasury.toBigInt();

		const params: ReportContractParams = [
			report.id,
			report.height,
			treasurySupplyChange,
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
		];

		return params;
	}
}

SystemReport.registerSerializer(
	ReportSerializerVersions.V1,
	new ReportSeralizerV1()
);
