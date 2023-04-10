export type ReportData = {
	bundleId: string;
	blockheight: number;
	streams: string[];
	writeCaptureAmounts: number[];
	writeBytes: number[];
	readConsumerAddress: string[];
	readCaptureAmounts: number[];
	readBytes: number[];
	nodes: string[];
	nodeChanges: number[];
	delegates: string[];
	delegateNodes: string[][];
	delegateNodeChanges: number[][];
	treasurySupplyChange: number;
	address: string[];
	signatures?: string[];
};
