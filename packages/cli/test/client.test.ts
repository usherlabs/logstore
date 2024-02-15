import { expect, test } from 'vitest';

import { getTestLogStoreClient } from './utils';

/*
 * This file is dedicated to test directly the functions used on the cli, and not the cli itself
 */

test('instantiates client correctly', async () => {
	using cleanup = new DisposableStack();
	const { logStoreClient } = getTestLogStoreClient(
		'0x0000000000000000000000000000000000000000000000000000000000000011'
	);
	cleanup.defer(() => logStoreClient.destroy());
	const price = await logStoreClient.getPrice();
	expect(typeof price).toBe('bigint');
	expect(price).toBeGreaterThan(1);
});
