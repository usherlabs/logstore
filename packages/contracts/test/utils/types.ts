import { BigNumber } from 'ethers';

export type ReportData = {
	fee: BigNumber;
	bundleId: string;
	streams: string[];
	address: string[];
	blockheight: number;
	signatures?: string[];
	nodesPerStream: string[][];
	bytesObservedPerNode: number[][];
	bytesMissedPerNode: number[][];
	bytesQueriedPerNode: number[][];
	consumerAddresses: string[][];
	bytesQueriedPerConsumer: number[][];
};
