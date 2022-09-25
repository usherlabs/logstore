import 'dotenv/config';

import StreamrClient from 'streamr-client';

const streamrClient = new StreamrClient({
	auth: {
		privateKey: process.env.EVM_PRIVATE_KEY,
	},
});

(async () => {
	await streamrClient.publish(
		{
			id: 'ryanwould.eth/usher',
		},
		{ some: 'event', increment: 'uni' }
	);

	console.log('stream message published!');
})();
