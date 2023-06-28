import { ReportSerializerVersions } from '../report/ReportSerializerVersions';
import type { QueryOptions } from '../system/QueryRequest';
import { HexString } from './report.common';

export type ReportV1Event = {
	id: string;
	hash: string;
	size: number;
};

export type ReportV1EventSerialized = {
	id: HexString;
	hash: string;
	size: number;
};

interface CaptureBase {
	bytes: number;
}

export interface IReportV1Stream extends CaptureBase {
	id: string;
	capture: number;
}

export interface IReportV1StreamSerialized extends CaptureBase {
	id: HexString;
	capture: HexString;
}

export interface IReportV1Consumer extends CaptureBase {
	id: string;
	capture: number;
}

export interface IReportV1ConsumerSerialized extends CaptureBase {
	id: string;
	capture: HexString;
}

export type ReportV1Nodes = Record<string, number>;

export type ReportV1Delegates = Record<string, Record<string, number>>;

export type ReportV1NodesSerialized = Record<string, HexString>;

export type ReportV1DelegatesSerialized = Record<
	string,
	Record<string, HexString>
>;

interface ReportBase {
	s: boolean; // serialized flag
	v: ReportSerializerVersions;
	id: string;
	height: number;
}

export interface IReportV1 extends ReportBase {
	treasury: number;
	streams: IReportV1Stream[];
	consumers: IReportV1Consumer[];
	nodes: Record<string, number>;
	delegates: Record<string, Record<string, number>>;

	// The following properties are not signed by the Broker Nodes
	events?: {
		queries: (ReportV1Event & {
			query: QueryOptions;
			consumer: string;
		})[];
		storage: ReportV1Event[];
	};
}

export interface IReportV1Serialized extends ReportBase {
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
