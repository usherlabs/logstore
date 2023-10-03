import { waitForTx } from '@logsn/streamr-client';
import { fetchPrivateKeyWithGas } from '@streamr/test-utils';
import { Logger } from '@streamr/utils';
import Decimal from 'decimal.js';
import { ethers, providers, Wallet } from 'ethers';

import { CONFIG_TEST } from '../../src/ConfigTest';
import { LogStoreClient } from '../../src/LogStoreClient';

const MINT_AMOUNT = 100_000_000_000_000n;
const TIMEOUT = 90 * 1000;

const logger = new Logger(module, undefined, 'trace');

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
			const balance = await accountClient.getBalance();
			const price = await accountClient.getPrice();

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

			const tx = await waitForTx(accountClient.mint(mintWei));

			const newBalance = await accountClient.getBalance();
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
			const price = await accountClient.getPrice();

			const inWei = new Decimal('1e18');
			const inBytes = inWei.div(price.toString()).floor();

			logger.debug(`Converting ${inBytes} bytes to wei`);
			logger.debug(`Converting ${inWei} wei to usd`);

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

			expect(ethers.utils.formatEther(bytesToWei)).toMatchInlineSnapshot(
				`"0.999999999909759537"`
			);

			// $0.709104 at 28/07/2023. We will assume that pricing will be between 0.3 and 1.5 USD
			expect(+weiToUsd).toBeGreaterThan(0.3);
			expect(+weiToUsd).toBeLessThan(1.5);
		},
		TIMEOUT
	);
});
