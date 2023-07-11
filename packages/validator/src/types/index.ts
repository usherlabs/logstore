import type { IRuntime } from '@kyvejs/protocol';
import { MessageMetadata } from '@logsn/client';
import type {
	IReportV1,
	ProofOfMessageStored,
	QueryRequest,
	QueryResponse,
} from '@logsn/protocol';
import Decimal from 'decimal.js';
import { BigNumber } from 'ethers';

import type { SystemListener, TimeIndexer } from '../threads';
import type Validator from '../validator';

export interface IRuntimeExtended extends IRuntime {
	listener: SystemListener;
	time: TimeIndexer;
	setupThreads?: (core: Validator, homeDir: string) => void;
	startBlockNumber(): Promise<number>;
	startKey(): Promise<number>;
}

export interface IConfig {
	systemStreamId: string;
	sources: string[];
	fees: {
		writeMultiplier: number;
		treasuryMultiplier: number;
		readMultiplier: number;
	};
}

export interface IBrokerNode {
	id: string;
	index: number;
	metadata: string;
	lastSeen: number;
	next: string;
	prev: string;
	stake: BigNumber;
	delegates: Record<string, BigNumber>;
}

export type StreamrMessage = {
	// eslint-disable-next-line
	content: any;
	metadata: MessageMetadata;
};

export type QueryResponseMessage = Omit<StreamrMessage, 'content'> & {
	content: QueryResponse;
};

export type QueryRequestMessage = Omit<StreamrMessage, 'content'> & {
	content: QueryRequest;
};

export type ProofOfMessageStoredMessage = Omit<StreamrMessage, 'content'> & {
	content: ProofOfMessageStored;
};

// ? The following REPORT interface is specific to the Validator. It is then serialized after generation.
export type ValidatorReportEvent = {
	id: string;
	hash: string;
	size: number;
};
export interface IValidatorReport
	extends Pick<IReportV1, 'id' | 'height' | 'events'> {
	treasury: Decimal;
	streams: {
		id: string;
		capture: Decimal;
		bytes: number;
	}[];
	consumers: {
		id: string;
		capture: Decimal;
		bytes: number;
	}[];
	nodes: Record<string, Decimal>;
	delegates: Record<string, Record<string, Decimal>>;
}
