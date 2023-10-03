import { getLogStoreClientFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';

export const createStreamCommand = new Command()
	.command('create-stream')
	.description(
		'Create Streamr stream to start storing data transported over the stream.'
	)
	.argument('<name>', 'Streamr stream name - ie. your_id/stream_name.')
	.action(async (name: string) => {
		// const provider = new ethers.providers.JsonRpcProvider(rootOptions.host);
		// const signer = new ethers.Wallet(rootOptions.wallet, provider);
		const client = getLogStoreClientFromOptions();
		const stream = await client.createStream({
			// id: name.charAt(0) === '/' ? name : `/${name}`,
			id: name,
		});
		logger.info(stream);
	});
