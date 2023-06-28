import { ReportSerializerVersions } from '../report/ReportSerializerVersions';
import type { QueryOptions } from '../system/QueryRequest';
import { HexString } from './report.common';

export type ReportV1Event = {
	id: string;
	hash: string;
	size: number;
};

export type ReportV1QueryEvent = ReportV1Event & {
	query: QueryOptions;
	consumer: string;
}

export type ReportV1EventSerialized = [
	// id
	HexString,
	// hash
	string,
	// size
	number
]

export interface IReportV1Stream{
	id: string;
	capture: number;
	bytes: number;
}

export type IReportV1StreamSerialized = [
	// id
	HexString,
	// capture
	HexString,
	// bytes
	number
]

export interface IReportV1Consumer {
	id: string;
	capture: number;
	bytes: number;
}

export type IReportV1ConsumerSerialized = [
	// id
	string,
	// capture
	number,
	// bytes
	number
]

export type ReportV1Nodes = Record<string, number>;

export type ReportV1Delegates = Record<string, Record<string, number>>;

export type ReportV1NodesSerialized = Record<string, HexString>;

export type ReportV1DelegatesSerialized = Record<
	string,
	Record<string, HexString>
>;

export type ReportV1QueryEventsSerialized = [
	[]
]
export interface IReportV1 {
	v: ReportSerializerVersions;
	id: string;
	height: number;
	treasury: number;
	streams: IReportV1Stream[];
	consumers: IReportV1Consumer[];
	nodes: Record<string, number>;
	delegates: Record<string, Record<string, number>>;

	// The following properties are not signed by the Broker Nodes
	events?: {
		queries: ()[];
		storage: ReportV1Event[];
	};
}

export type IReportV1Serialized = [
	// Version
	ReportSerializerVersions,
	// id
	string,
	// height
	number,
	// treasury
	HexString,
	IReportV1StreamSerialized[],
	IReportV1ConsumerSerialized[],
	ReportV1NodesSerialized,
	ReportV1DelegatesSerialized,
	ReportV1QueryEventsSerialized[],
	ReportV1StorageEventsSerialized[]
]

{
	treasury: HexString;
	streams: IReportV1StreamSerialized[];
	consumers: IReportV1ConsumerSerialized[];
	nodes: Record<string, HexString>;
	delegates: Record<string, Record<string, HexString>>;

	// The following properties are not signed by the Broker Nodes
	events?: {
		queries: (ReportV1EventSerialized & {
			query: QueryOptions;
			consumer: string;
		})[];
		storage: ReportV1EventSerialized[];
	};
}
