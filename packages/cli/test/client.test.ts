import { expect, test } from 'vitest';

import { getTestLogStoreClient } from './utils';

/*
 * This file is dedicated to test directly the functions used on the cli, and not the cli itself
 */

test('instantiates client correctly', async () => {
	const client = getTestLogStoreClient(
		'0x0000000000000000000000000000000000000000000000000000000000000011'
	);
	const price = await client.getPrice();
	expect(typeof price).toBe('bigint');
	expect(price).toBe(517348683n);
});
