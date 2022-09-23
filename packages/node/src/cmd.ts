import { Command } from 'commander';

// import { appVersion } from './env-config';

const cmd = new Command();

cmd.option(
	'-e, --evm-private-key <string>',
	'An EVM-compatible Wallet Private Key'
);

export { cmd };
