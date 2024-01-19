import { toEthereumAddress } from "@streamr/utils";
import { Argument } from 'commander';
import { StorageNodeMetadata, } from "streamr-client";

export const metadataArgument = new Argument(
	'metadata',
	'StorageProxy metadata representing its http endpoint. ie. { "http": "http://127.0.0.1:7171" }'
).argParser((value) => {
	return JSON.parse(value) as StorageNodeMetadata;
});

export const nodeArgument = new Argument(
	'node <address>',
	'StorageProxy Node address'
)
	.argParser((value) => {
		return toEthereumAddress(value);
	});
