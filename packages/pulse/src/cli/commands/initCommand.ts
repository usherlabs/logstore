import { Command } from 'commander';

import { Pulse } from '../../Pulse';
import { getClients } from '../../utils/getClient';
import { amountArgument } from '../arguments';
import {
	devNetworkOption,
	privateKeyOption,
} from '../options';

interface Options {
	devNetwork: boolean;
	privateKey: string;
}

export const initCommand = new Command('init')
	.description('Initialize LogStore Pulse stream')
	.addArgument(amountArgument)
	.addOption(devNetworkOption)
	.addOption(privateKeyOption)
	.action(async (amountStr: string, options: Options) => {
		const amount = BigInt(amountStr);

		const { logStoreClient, streamrClient } = getClients(
			options.privateKey,
			options.devNetwork
		);

		try {
			const pulse = new Pulse(logStoreClient, streamrClient);
			await pulse.createStream(amount);
		} finally {
			logStoreClient.destroy();
			streamrClient.destroy();
		}
	});
