import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';

const listCommand = new Command()
	.name('list')
	.description('List your streams')
	.action(async () => {
		try {
			const client = getLogStoreClientFromOptions();

			const streams = client.searchStreams(
				await client.getAddress(),
				undefined
			);

			for await (const stream of streams) {
				console.log(stream.id);
			}
		} catch (e) {
			logger.info(chalk.red('Listing streams failed'));
			logger.error(e);
		}
	});

export default listCommand;
