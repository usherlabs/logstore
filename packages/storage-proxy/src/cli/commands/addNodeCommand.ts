import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { EthereumAddress } from 'streamr-client';

import { addNodeToStorageProxy } from '../../addNodeToStorageProxy';
import { nodeArgument } from '../arguments';

const logger = new Logger(module);

interface Options {
	privateKey: string;
	devNetwork: boolean;
}

export const addNodeCommand = new Command('add-node')
	.description('Add a Node to a StorageProxy')
	.addArgument(nodeArgument)
	.action(async (node: EthereumAddress) => {
		try {
			const options = program.optsWithGlobals() as Options;

			await addNodeToStorageProxy({
				...options,
				node,
			});
		} catch (err) {
			logger.error('Add a Node to a StorageProxy failed', { err });
		}
	});
