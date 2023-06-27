import { QueryOptions } from '@logsn/protocol';
import {
	getNodeManagerContract,
	getReportManagerContract, // IReport,
} from '@logsn/shared';
import { ethers } from 'ethers';

import config from '../configs/docker-1.env.json';

type HexString = string;

export type ReportEvent = {
	id: string;
	hash: string;
	size: number;
};

interface IReportEncoded {
	id: string;
	height: number;
	treasury: HexString;
	streams: {
		id: string;
		capture: HexString;
		bytes: number;
	}[];
	consumers: {
		id: string;
		capture: HexString;
		bytes: number;
	}[];
	nodes: Record<string, HexString>;
	delegates: Record<string, Record<string, HexString>>;

	// The following properties are not signed by the Broker Nodes
	events?: {
		queries: (ReportEvent & {
			query: QueryOptions;
			consumer: string;
		})[];
		storage: ReportEvent[];
	};
}

// Example Report Payload signed by a single Broker Node -- ie docker-1.env.json
/**
 * Original Payload
const payload = {
	id: '1687874606',
	blockHeight: 1295,
	streams: ['0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat'],
	writeCaptureAmounts: [
		{
			type: 'BigNumber',
			hex: '0x28ea016f8839de61653800',
		},
	],
	writeBytes: [49542],
	readConsumerAddresses: ['0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8'],
	readCaptureAmounts: [
		{
			type: 'BigNumber',
			hex: '0x2f302e33cebaa6e95c00',
		},
	],
	readBytes: [4464],
	nodes: ['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	nodeChanges: [
		{
			type: 'BigNumber',
			hex: '-0x28ea016f8839de61653800',
		},
	],
	delegates: ['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	delegateNodes: [['0x5e98df807C09a91557D8B3161f2D01852fb005B9']],
	delegateNodeChanges: [
		[
			{
				type: 'BigNumber',
				hex: '0x00',
			},
		],
	],
	treasurySupplyChange: {
		type: 'BigNumber',
		hex: '0x00',
	},
	addresses: ['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	signature: [
		'0xd8d75473988430f2f0a389df535588d71a24decbe13205bda9aff01e188631627862bd6c799c8fb14a570132152c90ea7d77f5f2dc2adcd621850ceb25852bc51b',
	],
};
 */

const payload: IReportEncoded = {
	id: '1687874606',
	blockHeight: 1295,
	streams: [
		{
			id: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat',
		},
	],
	writeCaptureAmounts: ['0x28ea016f8839de61653800'],
	writeBytes: [49542],
	readConsumerAddresses: ['0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8'],
	readCaptureAmounts: ['0x2f302e33cebaa6e95c00'],
	readBytes: [4464],
	nodes: ['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	nodeChanges: ['-0x28ea016f8839de61653800'],
	delegates: ['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	delegateNodes: [['0x5e98df807C09a91557D8B3161f2D01852fb005B9']],
	delegateNodeChanges: [['0x00']],
	treasurySupplyChange: '0x00',
	addresses: ['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	signature: [
		'0xd8d75473988430f2f0a389df535588d71a24decbe13205bda9aff01e188631627862bd6c799c8fb14a570132152c90ea7d77f5f2dc2adcd621850ceb25852bc51b',
	],
};

const formatReportForContract = (report: IReportEncoded) => {
	const output = {
		id: report.id,
		blockHeight: report.height,
		// -- streams
		streams: report.streams.map(({ id }) => id.toLowerCase()),
		writeCaptureAmounts: report.streams.map(({ capture }) => capture),
		writeBytes: report.streams.map(({ bytes }) => bytes),
		// -- streams

		// -- consumers
		readConsumerAddresses: report.consumers.map(({ id }) => id),
		readCaptureAmounts: report.consumers.map(({ capture }) => capture),
		readBytes: report.consumers.map(({ bytes }) => bytes),
		// -- consumers

		// -- nodes
		nodes: Object.keys(report.nodes),
		nodeChanges: Object.values(report.nodes),
		// -- nodes

		// -- delegates
		delegates: Object.keys(report.delegates),
		delegateNodes: Object.keys(report.delegates).map((delegate) =>
			Object.keys(report.delegates[delegate])
		),
		delegateNodeChanges: Object.keys(report.delegates).map((delegate) =>
			Object.values(report.delegates[delegate])
		),
		// -- delegates
		treasurySupplyChange: report.treasury,
		// -- signature and broker validations
		addresses: this.reportsBuffer.map((buffer) => buffer.address),
		signatures: this.reportsBuffer.map((buffer) => buffer.signature),
		// -- signature and broker validations
	};
	return output;
};

// ? Emulate the report submission process inside of Broker Node.
(async () => {
	const signer = new ethers.Wallet(config.client.auth.privateKey);
	const nodeManagerContract = await getNodeManagerContract(signer);
	const reportManagerContract = await getReportManagerContract(signer);

	const fr = formatReportForContract(payload);

	const submitReportTx = await reportManagerContract.report(
		fr.id,
		fr.blockHeight,
		fr.streams,
		fr.writeCaptureAmounts,
		fr.writeBytes,
		fr.readConsumerAddresses,
		fr.readCaptureAmounts,
		fr.readBytes,
		fr.nodes,
		fr.nodeChanges,
		fr.delegates,
		fr.delegateNodes,
		fr.delegateNodeChanges,
		fr.treasurySupplyChange,
		fr.addresses,
		fr.signatures
	);
	await submitReportTx.wait();
	console.log(
		`Report submitted to the contract on tx:${submitReportTx.hash}; about to process report`
	);

	const processReportTx = await nodeManagerContract.processReport(fr.id);
	await processReportTx.wait();

	console.log(`Report:${report.id} processed on tx:${submitReportTx.hash};`);
})();
