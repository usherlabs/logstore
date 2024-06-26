import { Option } from 'commander';

export const devNetworkOption = new Option(
	'--dev-network',
	'Connect to LogStore DevNetwork.'
)
	.env('DEV_NETWORK')
	.default(false);

export const privateKeyOption = new Option(
	'--private-key <pk>',
	'EVM Private Key'
)
	.env('PRIVATE_KEY')
	.makeOptionMandatory();
