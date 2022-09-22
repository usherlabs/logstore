import 'dotenv/config';
import { Command } from 'commander';

import { Node, Arweave, Gzip, JsonFileCache } from '@kyve/core';
import Runtime from './runtime';

const startCmd = new Command();

startCmd
	.name('start')
	.description('Start the ETL Network Validator Node')
	.requiredOption(
		'-e, --evm-private-key <string>',
		'An EVM-compatible Wallet Private Key'
	)
	.action(() => {
		new Node()
			.addRuntime(new Runtime())
			.addStorageProvider(new Arweave())
			.addCompression(new Gzip())
			.addCache(new JsonFileCache())
			.start();
	});

const program = new Command();

program.addCommand(startCmd);

program.parse(process.argv);
