import { LogStoreClient } from '@logsn/client';
import { allowanceConfirmFn } from '@logsn/shared';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';
import inquirer from 'inquirer';
import { Logger } from 'tslog';

export const logger = new Logger();
let logstore: LogStoreClient;

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

export const getLogStoreClient = ({ key }) => {
	if (!logstore) {
		logstore = new LogStoreClient({
			auth: {
				privateKey: key,
			},
		});
	}
	return logstore;
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
	let tx: ethers.ContractTransaction;
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
