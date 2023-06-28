export type HexString = string;

export type ReportContractParamsBase = [
	// id
	string,
	// blockHeight
	number,
	// streams
	string[],
	// writeCaptureAmounts
	bigint[],
	// writeBytes
	number[],
	// readConsumerAddresses
	string[],
	// readCaptureAmounts,
	bigint[],
	// readBytes,
	number[],
	// nodes,
	string[],
	// nodeChanges,
	bigint[],
	// delegates,
	string[],
	// delegateNodes,
	string[][],
	// delegateNodeChanges,
	bigint[][],
	// treasurySupplyChange,
	bigint
];

export type ReportContractParams = [
	...ReportContractParamsBase,
	// addresses,
	string[],
	// signatures
	string[]
];
