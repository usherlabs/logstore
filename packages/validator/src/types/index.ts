import { Wallet } from '@ethersproject/wallet';
import type { IRuntime } from '@kyvejs/protocol';
import { LogStoreClient, MessageMetadata } from '@logsn/client';
import type {
	IReportV1,
	QueryPropagate,
	QueryRequest,
	QueryResponse,
} from '@logsn/protocol';
import Decimal from 'decimal.js';
import { BigNumber } from 'ethers';
import { Logger } from 'tslog';

import { Managers } from '../managers';
import { ChainSources } from '../sources';
import type { EventsIndexer, SystemListener, TimeIndexer } from '../threads';
import { Heartbeat } from '../threads/Heartbeat';
import { QueryMetadataManager } from '../threads/queryMetadata/QueryMetadataManager';
import type Validator from '../validator';

export interface IRuntimeExtended extends IRuntime {
	validator: Validator;
	listener: SystemListener;
	time: TimeIndexer;
	chain: ChainSources;
	events: EventsIndexer;
	heartbeat: Heartbeat;
	managers: Managers;
	logger: Logger;
	logStoreClient: LogStoreClient;
	queryMetadataManager: QueryMetadataManager;
	signer: Wallet;
	setup?: (core: Validator, homeDir: string) => Promise<void>;
	runThreads?: (core: Validator) => void;
	getPreviousKeyForDataItemKey: (key: string) => string;
	ready?: (
		core: Validator,
		syncPoolState: () => Promise<void>
	) => Promise<void>;

	startKey(): Promise<number>;

	startBlockNumber(): Promise<number>;
}

export interface IConfig {
	heartbeatStreamId: string;
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

export type QueryRequestMessage = Omit<StreamrMessage, 'content'> & {
	content: QueryRequest;
};

export type QueryResponseMessage = Omit<StreamrMessage, 'content'> & {
	content: QueryResponse;
};

export type QueryPropagateMessage = Omit<StreamrMessage, 'content'> & {
	content: QueryPropagate;
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
