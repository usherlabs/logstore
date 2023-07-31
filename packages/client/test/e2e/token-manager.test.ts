import { waitForTx } from '@logsn/streamr-client';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import Decimal from 'decimal.js';
import { ethers, providers, Wallet } from 'ethers';

import { CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';

const MINT_AMOUNT = 100_000_000_000_000n;
const TIMEOUT = 90 * 1000;

describe('Manage tokens', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let account: Wallet;
	let accountClient: LogStoreClient;

	beforeAll(async () => {
		account = new Wallet(await fetchPrivateKeyWithGas(), provider);
		accountClient = new LogStoreClient({
			...CONFIG_TEST,
			auth: {
				privateKey: account.privateKey,
			},
		});
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([accountClient?.destroy()]);
	}, TIMEOUT);

	test(
		'Gets balance',
		async () => {
			const balance = await accountClient.getBalance();

			expect(balance).toBe(1000000000000000000000000000000000000n);
		},
		TIMEOUT
	);

	test(
		'Mints tokens',
		async () => {
			const balance = await accountClient.getBalance();
			const mintWei = MINT_AMOUNT;
			const price = await accountClient.getPrice();

			await waitForTx(accountClient.mint(mintWei));

			const newBalance = await accountClient.getBalance();

			const expectedBalance = balance + mintWei / price;

			expect(newBalance).toBe(expectedBalance);
		},
		TIMEOUT
	);

	test(
		'Converts tokens',
		async () => {
			const initialWeiPerByte = 523537909; // initial multiplier is also 1 so price is also 1


			// let's calculate for 1 byte only
			// we expect the LSAN to be just 1
			// and wei to be initialWeiPerByte
			const inWei = new Decimal('1e18');
			const inBytes = inWei.div(initialWeiPerByte);

			const bytesToWei = await accountClient.convert({
				from: 'bytes',
				to: 'wei',
				amount: inBytes.toString(),
			});

			const weiToUsd = await accountClient.convert({
				from: 'wei',
				to: 'usd',
				amount: inWei.toString(),
			});

			// this amount of tokens should be enough to buy 1 byte
			expect(ethers.utils.formatEther(bytesToWei)).toMatchInlineSnapshot(
				`"1.0"`
			);

			// $0.709104 at 28/07/2023. We will assume that pricing will be between 0.3 and 1.5 USD
			expect(+weiToUsd).toBeGreaterThan(0.3);
			expect(+weiToUsd).toBeGreaterThan(1.5);
		},
		TIMEOUT
	);
});
