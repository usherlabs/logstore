import { getClientsFromOptions } from '@/utils/logstore-client';
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
		const { streamrClient } = getClientsFromOptions();
		console.log('Creating a stream...');
		const stream = await streamrClient.createStream({
			// id: name.charAt(0) === '/' ? name : `/${name}`,
			id: name,
		});
		// link shape: https://streamr.network/hub/streams/streamr.eth%2Fmetrics%2Fnodes%2Ffirehose%2Fsec/overview
		const escapedStreamId = stream.id.replace('/', '%2F');
		console.log('Created!');
		console.log(`Stream ID: ${stream.id}`);
		console.log(
			`Streamr's Stream Explorer: https://streamr.network/hub/streams/${escapedStreamId}/overview`
		);
	});
