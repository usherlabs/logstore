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
export const metadataOption = new Option(
	'-m, --metadata <string>',
	`Broker Node's metadata representing its http endpoint. ie. { "http": "http://127.0.0.1:7171" }`
);

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

export const assumeYesOption = new Option(
	'-y, --assume-yes',
	' Assume Yes to all queries and do not prompt'
);
