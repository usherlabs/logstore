import { readFeeMultiplier } from '@/configuration';
import { getClientsFromOptions } from '@/utils/logstore-client';
import { allowanceConfirmFn } from '@logsn/shared';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import {
	BigNumber,
	type ContractReceipt,
	ContractTransaction,
	ethers,
	type Overrides,
	Signer,
	type Transaction,
} from 'ethers';
import inquirer from 'inquirer';
import _ from 'lodash';
import { Logger } from 'tslog';

export const logger = new Logger();

export const allowanceConfirm: allowanceConfirmFn = async (
	currentAllowance: bigint,
	requiredAllowance: bigint
) => {
	logger.debug(`Current allowance: ${currentAllowance.valueOf()}`);
	logger.debug(`Required allowance: ${requiredAllowance.valueOf()}`);

	const answers = await inquirer.prompt([
		{
			name: 'confirm',
			type: 'confirm',
			message:
				'Are you sure you want to continue? Once funded, this cannot be reversed.',
			default: true,
		},
	]);
	if (!answers.confirm) {
		process.exit(0);
	}
	return true;
};

export const bytesToMessage = (bytes: Decimal) => {
	const storageKb = bytes.div(1000);
	const storageMb = bytes.div(1000 * 1000);
	const storageGb = bytes.div(1000 * 1000 * 1000);
	const storageTb = bytes.div(1000 * 1000 * 1000 * 1000);
	if (storageTb.gte(1)) {
		return `${storageTb.toString()} TB`;
	} else if (storageGb.gte(1)) {
		return `${storageGb.toString()} GB`;
	} else if (storageMb.gte(1)) {
		return `${storageMb.toString()} MB`;
	} else if (storageKb.gte(1)) {
		return `${storageKb.toString()} KB`;
	} else {
		return `${bytes.toString()} bytes`;
	}
};

export const withRetry = async (
	provider: ethers.providers.JsonRpcProvider,
	fn: (estimate?: ethers.BigNumber) => Promise<ethers.ContractTransaction>
) => {
	let tx: ethers.ContractTransaction | undefined;
	let estimate = await provider.getGasPrice();
	let retryCount = 0;
	while (!tx) {
		try {
			tx = await fn(estimate);
			break;
		} catch (e) {
			logger.warn(
				'Failed to submit transaction. Retrying with a new gas estimate...'
			);
			if (
				e.message.match(
					/replacement transaction underpriced|transaction gas price.*too low/i
				)
			) {
				estimate = await provider.getGasPrice();
				retryCount++;
				estimate.add(100000 * retryCount);
			} else {
				throw e;
			}
		}
	}

	return tx;
};

export const getTransactionFee = async (receipt: ContractReceipt) => {
	const { streamrClient, logStoreClient } = getClientsFromOptions();

	await using cleanup = new AsyncDisposableStack();
	cleanup.defer(async () => {
		logStoreClient.destroy();
		await streamrClient.destroy();
	});

	const gasUsed = receipt.gasUsed;
	// in tests, effective gas price doesnt exist
	const gasPrice = receipt.effectiveGasPrice ?? 0;
	const feeWei = gasUsed.mul(gasPrice).toString();
	const feeUsd = await logStoreClient.convert({
		amount: feeWei,
		from: 'wei',
		to: 'usd',
	});
	return {
		wei: new Decimal(feeWei),
		usd: new Decimal(feeUsd),
	};
};

type BaseAmount = 'byte' | 'query' | 'wei' | 'usd';

export async function printPrices(base: BaseAmount = 'byte') {
	const { streamrClient, logStoreClient } = getClientsFromOptions();

	await using cleanup = new AsyncDisposableStack();
	cleanup.defer(async () => {
		logStoreClient.destroy();
		await streamrClient.destroy();
	});

	const weiPerBytePrice = await logStoreClient
		.getPrice()
		.then((c) => new Decimal('0x' + c.toString(16)));
	const usdPerByte = await logStoreClient
		.convert({
			amount: '1',
			from: 'bytes',
			to: 'usd',
		})
		.then((c) => new Decimal(c));

	const queryBytes = new Decimal(1 / readFeeMultiplier);
	const storagePrice = new Decimal(1);
	const lsanPerByte = new Decimal(1);

	const baseAmount =
		base === 'byte'
			? storagePrice
			: base === 'query'
				? queryBytes
				: base === 'wei'
					? weiPerBytePrice
					: base === 'usd'
						? usdPerByte
						: new Error('Invalid base amount');

	if (baseAmount instanceof Error) {
		throw baseAmount;
	}

	console.info(chalk.bold(`Current prices:`));
	console.info(
		`${bytesToMessage(
			storagePrice.div(baseAmount)
		)} (storage) = ${bytesToMessage(
			queryBytes.div(baseAmount)
		)} (query) = ${lsanPerByte.div(baseAmount)} LSAN = ${weiPerBytePrice.div(
			baseAmount
		)} wei (MATIC) = ${usdPerByte.div(baseAmount)} USD`
	);
}

// TODO: maybe from client we could get the network name?
export async function printTransactionLink(receipt: ContractReceipt) {
	const polyScanUrl = `https://polygonscan.com/tx/${receipt.transactionHash}`;
	console.info(chalk.bold(`View transaction:`));
	console.info(polyScanUrl);
}

export function printContractFailReason(e: unknown) {
	const reason = _.get(e, 'reason.reason');
	if (reason) {
		console.log('Reason: ', reason);
	}
}

export async function getTransferAmountFromEcr2Transfer(
	receipt: ethers.providers.TransactionReceipt
) {
	const erc20Abi = [
		// Only include the Transfer event ABI
		'event Transfer(address indexed from, address indexed to, uint amount)',
	];

	const iface = new ethers.utils.Interface(erc20Abi);
	const decodedLogs = receipt.logs.map((log) => {
		try {
			return iface.parseLog(log);
		} catch (e) {
			return undefined;
		}
	});

	const transferEvent = decodedLogs.find((log) => log?.name === 'Transfer');

	const valueTransfered = transferEvent?.args[2];

	if (!valueTransfered) throw new Error('No value transfered');
	//
	const bn = BigNumber.from(valueTransfered).toHexString();
	const resultingLSAN = new Decimal(bn);
	return resultingLSAN;
}

export async function checkLSANFunds(_triedUsing: Decimal.Value) {
	const triedUsing = new Decimal(_triedUsing);
	const { streamrClient, logStoreClient } = getClientsFromOptions();

	await using cleanup = new AsyncDisposableStack();
	cleanup.defer(async () => {
		logStoreClient.destroy();
		await streamrClient.destroy();
	});

	const balance = await logStoreClient.getBalance().then(String);

	if (triedUsing.greaterThan(balance)) {
		throw new Error(
			`Insufficient LSAN funds. Tried using ${triedUsing} but only have ${balance}. Difference: ${triedUsing.minus(
				balance
			)}`
		);
	}
}

export async function replaceTransaction(
	signer: Signer,
	contractTransaction: Transaction | ContractTransaction,
	overrrides: Overrides
) {
	const props = [
		'to',
		'from',
		'nonce',
		'gasLimit',
		'gasPrice',
		'data',
		'value',
		'chainId',
		'type',
		'accessList',
		'maxPriorityFeePerGas',
		'maxFeePerGas',
		'customData',
		'ccipReadEnabled',
	] as const;
	const newTx = await signer.sendTransaction({
		..._.pick(contractTransaction, props),
		...overrrides,
		type: contractTransaction.type ?? undefined,
	} satisfies Parameters<typeof signer.sendTransaction>[0]);
	return newTx;
}

export async function printTransactionFee(receipt: ContractReceipt) {
	const fee = await getTransactionFee(receipt);

	console.log(`Transaction fee: ${ethers.utils.formatUnits(
		fee.wei.toHexadecimal(),
		'gwei'
	)} gwei ($${fee.usd.toFixed(4)})
				`);
}
