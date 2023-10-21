import { waffleJest } from '@ethereum-waffle/jest';
import { MockProvider } from '@ethereum-waffle/provider';
import {
	LogStoreManager__factory,
	LogStoreNodeManager__factory,
	LogStoreReportManager__factory,
	VerifySignature__factory,
} from '@logsn/contracts';
import { TypedEvent } from '@logsn/contracts/dist/common';
import _ from 'lodash';

import { ChainSources, IChainSource } from '../../src/sources';

expect.extend(waffleJest);

export class ChainSourcesMock extends ChainSources {
	constructor(mockSources: IChainSource[]) {
		super([]);
		super._sources = mockSources;
	}
}

const contractAndResponses = {
	node: [{ address: 'node1', blockNumber: 1 }],
	report: [
		{ address: 'report1', blockNumber: 1 },
		{ address: 'report2', blockNumber: 2 },
	],
	store: [{ address: 'store1', blockNumber: 3 }],
} as {
	[key: string]: Array<Partial<TypedEvent>>;
};
const contractsMockFns = _.map(contractAndResponses, (res, c) => ({
	[c]: (
		jest.fn() as jest.SpiedFunction<IChainSource['contracts']['node']>
	).mockResolvedValue({
		queryFilter: jest.fn().mockResolvedValue(res),
		// @ts-expect-error this is a mock
		filters: {
			StakeDelegateUpdated: jest.fn(),
		},
	}),
}));

export const contractsMock = Object.assign({}, ...contractsMockFns);

export const mockProvider = new MockProvider();
export const getContractMock = async () => {
	const [adminWallet] = mockProvider.getWallets();
	const nodeManager = await new LogStoreNodeManager__factory(
		adminWallet
	).deploy();

	const verifySignature = await new VerifySignature__factory(
		adminWallet
	).deploy();

	const reportManager = await new LogStoreReportManager__factory(
		{
			['src/lib/VerifySignature.sol:VerifySignature']: verifySignature.address,
		},
		adminWallet
	).deploy();

	const storeManager = await new LogStoreManager__factory(adminWallet).deploy();

	const contractMock = {
		node: async () => nodeManager,
		report: async () => reportManager,
		store: async () => storeManager,
	} satisfies IChainSource['contracts'];

	return {
		contractMock,
		adminWallet,
		nodeManager,
		reportManager,
		storeManager,
	};
};
