import { LogStoreClient } from '@logsn/client';
import { allowanceConfirmFn } from '@logsn/shared';
import Decimal from 'decimal.js';
import { ethers } from 'ethers';
import inquirer from 'inquirer';
import { Logger } from 'tslog';

export const logger = new Logger();
let logstore: LogStoreClient;

export const retryGasEstimate = {
	gasPrice: ethers.BigNumber.from('191636167321'),
};

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
	fn: (
		gasEstimate?: typeof retryGasEstimate
	) => Promise<ethers.ContractTransaction>
) => {
	try {
		const tx = await fn();
		return tx;
	} catch (e) {
		logger.warn(
			'Failed to submit first transaction. Retrying with a new gas estimate...'
		);
		try {
			const tx = await fn(retryGasEstimate);
			return tx;
		} catch (e2) {
			logger.error('Original Error:');
			logger.error(e);
			throw e2;
		}
	}
};
