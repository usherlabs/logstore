import { Argument, Option } from 'commander';

// Arguments
export const amountArgument = new Argument(
	'amount <number>',
	'Amount in Wei to stake into the Node Manager Contract. Ensure funds are available for queries to the Log Store Network.'
);

export const delegateAddressArgument = new Argument(
	'address <string>',
	'Address of node to delegate your stake to'
);

// Options
export const configOption = new Option(
	'-c, --config <path>',
	'configuration file'
);

export const usdOption = new Option(
	'-u, --usd',
	'Pass in an amount in USD which will automatically convert to the appropriate amount of token to stake.'
);

export const addressOption = new Option(
	'-d, --delegate',
	'Pass in the address of the node you want to delegate to'
);
