import { expect, it } from 'vitest';

import config from '../configs/development-1.env.json';
import { Config } from '../src/config/config';
import { createObserver } from '../src/observer';

// todo spy on classes as identify if components start correctly

it('is able to start', async () => {
	const typesafeConfig = {
		...config,
	} as Config;

	const observer = await createObserver(typesafeConfig);

	try {
		await observer.start();
	} catch (error) {
		console.error(error);
		process.exit(1);
	}

	const node = await observer.getNode();

	expect(node.getNodeId()).toBe('0x5cbdd86a2fa8dc4bddd8a8f69dba48572eec07fb');
});
