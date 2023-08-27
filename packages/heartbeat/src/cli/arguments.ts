import { Argument } from 'commander';

export const amountArgument = new Argument(
	'amount <number>',
	'Amount in Wei to stake into the Heartbeat store'
);
