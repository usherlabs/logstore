import { BigNumber } from '@ethersproject/bignumber';
import assert from 'assert';

import {
	IReportV1,
	IReportV1Serialized,
	ReportSerializerVersions,
	SystemReport,
	ValidationError,
} from '../src/exports';
import { ReportSeralizerV1 } from '../src/report/ReportSerializerV1';

const VERSION = ReportSerializerVersions.V1;
const PAYLOAD: IReportV1 = {
	s: false,
	v: 1,
	id: '1687874606',
	height: 1295,
	treasury: BigNumber.from(0),
	streams: [
		{
			id: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat',
			capture: BigNumber.from('49462093025057900000000000'),
			bytes: 49542,
		},
	],
	consumers: [
		{
			id: `0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8`,
			capture: BigNumber.from('222839997642262000000000'),
			bytes: 4464,
		},
	],
	nodes: {
		'0x5e98df807C09a91557D8B3161f2D01852fb005B9': BigNumber.from(
			'49462093025057900000000000'
		),
	},
	delegates: {
		'0x5e98df807C09a91557D8B3161f2D01852fb005B9': {
			'0x5e98df807C09a91557D8B3161f2D01852fb005B9': BigNumber.from(
				'49462093025057900000000000'
			),
		},
	},
	events: {
		queries: [
			{
				id: '0x5e98df807C09a91557D8B3161f2D01852fb005B9',
				hash: 'helloworld_query',
				size: 4464,
				query: { from: { timestamp: 91923091823 } },
				consumer: `0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8`,
			},
		],
		storage: [
			{
				id: '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat',
				hash: 'helloworld_storage',
				size: 49542,
			},
		],
	},
};

const PAYLOAD_SERIALIZED: IReportV1Serialized = {
	s: true,
	v: 1,
	id: '1687874606',
	height: 1295,
	treasury: '0x00',
	streams: [
		{
			id: '0x3078313965376533373665376332313362376537653765343663633730613564643038366461666632612f686561727462656174',
			capture: '0x28ea016f8839de61653800',
			bytes: 49542,
		},
	],
	consumers: [
		{
			id: `0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8`,
			capture: '0x2f302e33cebaa6e95c00',
			bytes: 4464,
		},
	],
	nodes: {
		'0x5e98df807C09a91557D8B3161f2D01852fb005B9': '0x28ea016f8839de61653800',
	},
	delegates: {
		'0x5e98df807C09a91557D8B3161f2D01852fb005B9': {
			'0x5e98df807C09a91557D8B3161f2D01852fb005B9': '0x28ea016f8839de61653800',
		},
	},
	events: {
		queries: [
			{
				id: '0x5e98df807C09a91557D8B3161f2D01852fb005B9',
				hash: 'helloworld_query',
				size: 4464,
				query: { from: { timestamp: 91923091823 } },
				consumer: `0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8`,
			},
		],
		storage: [
			{
				id: '0x3078313965376533373665376332313362376537653765343663633730613564643038366461666632612f686561727462656174',
				hash: 'helloworld_storage',
				size: 49542,
			},
		],
	},
};

const PAYLOAD_CONTRACT = [
	'1687874606',
	1295,
	BigInt('0'),
	['0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a/heartbeat'],
	[BigInt('49462093025057900000000000')],
	[49542],
	['0x3c9ef7f26d7c1de4e67580cdb26a10f9b9a8b8c8'],
	[BigInt('222839997642262000000000')],
	[4464],
	['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	[BigInt('49462093025057900000000000')],
	['0x5e98df807C09a91557D8B3161f2D01852fb005B9'],
	[['0x5e98df807C09a91557D8B3161f2D01852fb005B9']],
	[[BigInt('49462093025057900000000000')]],
];

describe('SystemReport', () => {
	let systemReport: SystemReport;
	let serializer: ReportSeralizerV1;

	beforeEach(() => {
		systemReport = new SystemReport(
			PAYLOAD,
			SystemReport.getVersionByNumber(PAYLOAD.v)
		);
		serializer = new ReportSeralizerV1();
	});

	describe('constructor', () => {
		it('validates properties', () => {
			// eslint-disable-next-line
			// @ts-ignore
			assert.throws(() => new SystemReport({}), ValidationError);
		});
		it('validates version', () => {
			assert.throws(
				() => new SystemReport({ ...PAYLOAD, v: 100 }),
				ValidationError
			);
		});
	});

	describe('registerSerializer', () => {
		beforeEach(() => {
			// Start from a clean slate
			SystemReport.unregisterSerializer(VERSION);
		});

		it('registers a Serializer retrievable by getSerializer()', () => {
			SystemReport.registerSerializer(VERSION, serializer);
			assert.strictEqual(SystemReport.getSerializer(VERSION), serializer);
		});
		it('throws if the Serializer for a Version is already registered', () => {
			SystemReport.registerSerializer(VERSION, serializer);
			assert.throws(() => SystemReport.registerSerializer(VERSION, serializer));
		});
	});

	describe('serialize', () => {
		it('should serialize the default payload', () => {
			// console.log(systemReport.serialize());
			assert.deepStrictEqual(systemReport.serialize(), PAYLOAD_SERIALIZED);
		});
		it('should produce contract JSON', () => {
			assert.deepStrictEqual(
				systemReport.toJSON(),
				JSON.stringify(PAYLOAD_SERIALIZED)
			);
		});
		it('should produce contract params', () => {
			// console.log('systemReport.toContract', systemReport.toContract());
			// console.log('PAYLOAD_CONTRACT', PAYLOAD_CONTRACT);
			assert.deepStrictEqual(systemReport.toContract(), PAYLOAD_CONTRACT);
		});
	});

	describe('deserialize', () => {
		let systemReport2: SystemReport;
		beforeEach(() => {
			systemReport2 = new SystemReport(PAYLOAD_SERIALIZED, VERSION);
		});

		it('should use seralized payload to produce deseralized payload', () => {
			assert.deepStrictEqual(systemReport2.deserialize(), PAYLOAD);
		});
		it('should use deserialized payload to produce JSON', () => {
			assert.deepStrictEqual(
				systemReport2.toJSON(),
				JSON.stringify(PAYLOAD_SERIALIZED)
			);
		});
		it('should use deserialized payload to contract params', () => {
			assert.deepStrictEqual(systemReport2.toContract(), PAYLOAD_CONTRACT);
		});
	});

	describe('getSupportedVersions', () => {
		it('returns an array of registered versions', () => {
			assert.deepStrictEqual(SystemReport.getSupportedVersions(), [
				VERSION as number,
			]);
		});
	});
});
