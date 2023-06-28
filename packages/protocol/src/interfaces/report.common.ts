export enum ReportSerializerVersions {
	V1 = 1,
}

export type HexString = string;

export type ReportContractParams = [
	// id
	string,
	// blockHeight
	number,
	// streams
	string[],
	// writeCaptureAmounts
	number[],
	// writeBytes
	number[],
	// readConsumerAddresses
	string[],
	// readCaptureAmounts,
	number[],
	// readBytes,
	number[],
	// nodes,
	string[],
	// nodeChanges,
	number[],
	// delegates,
	string[],
	// delegateNodes,
	string[][],
	// delegateNodeChanges,
	number[][],
	// treasurySupplyChange,
	number
];

// export type ReportContractParams = [
// 	...ReportContractParamsBase,
// 	// addresses,
// 	string[],
// 	// signatures
// 	string[]
// ];
