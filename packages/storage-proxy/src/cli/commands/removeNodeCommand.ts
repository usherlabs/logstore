import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { EthereumAddress } from 'streamr-client';

import { removeNodeFromStorageProxy } from '../../removeNodeFromStorageProxy';
import { nodeArgument } from '../arguments';

const logger = new Logger(module);

interface Options {
	privateKey: string;
	devNetwork: boolean;
}

export const removeNodeCommand = new Command('remove-node')
	.description('Remove a Node from a StorageProxy')
	.addArgument(nodeArgument)
	.action(async (node: EthereumAddress) => {
		try {
			const options = program.optsWithGlobals() as Options;

			await removeNodeFromStorageProxy({
				...options,
				node,
			});
		} catch (err) {
			logger.error('Remove a Node from a StorageProxy failed', { err });
		}
	});
