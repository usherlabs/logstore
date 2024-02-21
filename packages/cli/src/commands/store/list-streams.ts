import { getClientsFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';

const listCommand = new Command()
	.name('list')
	.description('List your streams')
	.action(async () => {
		try {
			const { streamrClient } = getClientsFromOptions();

			await using cleanup = new AsyncDisposableStack();
			cleanup.defer(async () => {
				await streamrClient.destroy();
			});

			const streams = streamrClient.searchStreams(
				await streamrClient.getAddress(),
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
