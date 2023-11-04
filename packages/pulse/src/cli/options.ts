import { Option } from 'commander';

export const devNetworkOption = new Option(
	'--dev-network',
	'Connect to LogStore DevNetwork.'
)
	.env('DEV_NETWORK')
	.default(false);

export const kyveApiUrlOption = new Option(
	'--kyve-api-url <url>',
	'KYVE API Url'
).env('KYVE_API_URL');

export const kyvePoolIdOption = new Option(
	'--kyve-pool-id <id>',
	'KYVE Pool ID'
).env('KYVE_POOL_ID');

export const privateKeyOption = new Option(
	'--private-key <pk>',
	'EVM Private Key'
)
	.env('PRIVATE_KEY')
	.makeOptionMandatory();
