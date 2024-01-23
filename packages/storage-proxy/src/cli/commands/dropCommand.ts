import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';

import { dropStorageProxy } from '../../dropStorageProxy';

const logger = new Logger(module);

interface Options {
	privateKey: string;
	devNetwork: boolean;
}

export const dropCommand = new Command('drop')
	.description('Drop a StorageProxy')
	.action(async () => {
		try {
			const options = program.optsWithGlobals() as Options;

			await dropStorageProxy({
				...options,
			});
		} catch (err) {
			logger.error('Drop a StorageProxy failed', { err });
		}
	});
