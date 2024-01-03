import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { Logger } from '@streamr/utils';
import Decimal from 'decimal.js';
import { ethers, providers, Wallet } from 'ethers';
import StreamrClient, { CONFIG_TEST } from 'streamr-client';

import { CONFIG_TEST as LOGSTORE_CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';
import { waitForTx } from '../../src/streamr/utils/contract';

const MINT_AMOUNT = 100_000_000_000_000n;
const TIMEOUT = 90 * 1000;

const logger = new Logger(module, undefined, 'trace');

describe('Manage tokens', () => {
	const provider = new providers.JsonRpcProvider(
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.rpcs[0].url,
		CONFIG_TEST.contracts?.streamRegistryChainRPCs?.chainId
	);

	let account: Wallet;
	let streamrClient: StreamrClient;
	let logStoreClient: LogStoreClient;

	beforeAll(async () => {
		account = new Wallet(await fetchPrivateKeyWithGas(), provider);
		streamrClient = new StreamrClient({
			...CONFIG_TEST,
			auth: {
				privateKey: account.privateKey,
			},
		});

		logStoreClient = new LogStoreClient(streamrClient, LOGSTORE_CONFIG_TEST);
	}, TIMEOUT);

	afterAll(async () => {
		await Promise.allSettled([streamrClient?.destroy()]);
	}, TIMEOUT);

	test(
		'Gets balance',
		async () => {
			const balance = await logStoreClient.getBalance();

			expect(typeof balance).toBe('bigint');
		},
		TIMEOUT
	);

	test(
		'Mints tokens',
		async () => {
			const mintWei = MINT_AMOUNT;

			const ethBalance = await provider
				.getBalance(account.address)
				.then((b) => b.toBigInt());
			const balance = await logStoreClient.getBalance();
			const price = await logStoreClient.getPrice();

			const mintResult = mintWei / price;
			const expectedBalance = balance + mintResult;
			const expectedEthBalanceWithoutGas = ethBalance - mintWei;

			logger.debug(`Current balance: ${balance}`);
			logger.debug(`Current eth balance: ${ethBalance}`);

			logger.debug(`We will input to mint ${mintWei} wei`);
			logger.debug(`However, it will divide by price: ${price}`);
			logger.debug(
				`And round down, so we expect to actually mint ${mintResult} LSAN`
			);

			logger.debug(`Expected balance: ${expectedBalance}`);
			logger.debug(
				`Expected eth balance without gas: ${expectedEthBalanceWithoutGas}`
			);

			const tx = await waitForTx(logStoreClient.mint(mintWei));

			const newBalance = await logStoreClient.getBalance();
			const _newEthBalance = await provider
				.getBalance(account.address)
				.then((b) => b.toBigInt());

			const gasPrice = tx.cumulativeGasUsed.toBigInt();
			const _expectedEthBalance = expectedEthBalanceWithoutGas - gasPrice;

			logger.debug(`Gas price: ${gasPrice}`);

			expect(newBalance).toBe(expectedBalance);
			// TODO figure out how to check this
			// expect(newEthBalance).toBe(expectedEthBalance);
		},
		TIMEOUT
	);

	test(
		'Converts tokens',
		async () => {
			const price = await logStoreClient.getPrice();

			const inWei = new Decimal('1e18');
			const inBytes = inWei.div(price.toString()).floor();

			logger.debug(`Converting ${inBytes} bytes to wei`);
			logger.debug(`Converting ${inWei} wei to usd`);

			const bytesToWei = await logStoreClient.convert({
				from: 'bytes',
				to: 'wei',
				amount: inBytes.toString(),
			});

			const weiToUsd = await logStoreClient.convert({
				from: 'wei',
				to: 'usd',
				amount: inWei.toString(),
			});

			expect(ethers.utils.formatEther(bytesToWei)).toMatchInlineSnapshot(
				`"0.99999999864981264"`
			);

			// $0.709104 at 28/07/2023. We will assume that pricing will be between 0.3 and 1.5 USD
			expect(+weiToUsd).toBeGreaterThan(0.3);
			expect(+weiToUsd).toBeLessThan(1.5);

			expect(
				await logStoreClient.convert({ amount: '1', from: 'usd', to: 'bytes' })
			).toBe('');
		},
		TIMEOUT
	);

	test('result from conversion to wei should be an integer', async () => {
		const inUsd = '0.001';

		logger.debug(`Converting ${inUsd} usd to wei`);

		const usdToWei = await logStoreClient.convert({
			from: 'usd',
			to: 'wei',
			amount: inUsd.toString(),
		});

		const result = new Decimal(usdToWei);
		const decimals = result.mod(1).toString();

		expect(decimals).toBe('0');
		expect(result.gte(0)).toBe(true);
	});
});
