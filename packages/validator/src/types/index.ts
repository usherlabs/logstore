import type { IRuntime } from '@kyvejs/protocol';
import { MessageMetadata } from '@logsn/client';
import type {
	ProofOfMessageStored,
	QueryRequest,
	QueryResponse,
} from '@logsn/protocol';

import type { SystemListener, TimeIndexer } from '../threads';
import type Validator from '../validator';

export type { IReport, ReportEvent } from '@logsn/shared';

export interface IRuntimeExtended extends IRuntime {
	listener: SystemListener;
	time: TimeIndexer;
	setupThreads?: (core: Validator, homeDir: string) => void;
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
	stake: number;
	delegates: Record<string, number>;
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
