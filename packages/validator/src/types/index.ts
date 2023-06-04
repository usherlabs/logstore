import type { IRuntime } from '@kyvejs/protocol';
import { MessageMetadata } from '@logsn/client';
import type { QueryOptions } from '@logsn/protocol';

import type Listener from '../listener';
import type Validator from '../validator';

export interface IRuntimeExtended extends IRuntime {
	listener: Listener;
	setupThreads?: (core: Validator, homeDir: string) => void;
}

export interface IConfig {
	systemStreamId: string;
	sources: string[];
	itemTimeRange: number; // Some range in unix time between each data item
	fees: {
		writeMultiplier: number;
		treasuryMultiplier: number;
		read: number; // Amount in USD cents
	};
}

export type ReportEvent = {
	id: string;
	hash: string;
	size: number;
};

export interface IReport {
	id: string;
	height: number;
	treasury: number;
	streams: {
		id: string;
		capture: number;
		bytes: number;
	}[];
	consumers: {
		id: string;
		capture: number;
		bytes: number;
	}[];
	nodes: Record<string, number>;
	delegates: Record<string, Record<string, number>>;

	// The following properties are not signed by the Broker Nodes
	events?: {
		queries: (ReportEvent & {
			query: QueryOptions;
			consumer: string;
		})[];
		storage: ReportEvent[];
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
