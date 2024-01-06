import { Command } from 'commander';

import { Pulse } from '../../Pulse';
import { getClients } from '../../utils/getClient';
// import { waitForKyve } from '../../utils/waitForKyve';
import { amountArgument } from '../arguments';
import {
	devNetworkOption,
	kyveApiUrlOption,
	kyvePoolIdOption,
	privateKeyOption,
} from '../options';

interface Options {
	devNetwork: boolean;
	kyveApiUrl: string;
	kyvePoolId: string;
	privateKey: string;
}

export const initCommand = new Command('init')
	.description('Initialize LogStore Pulse stream')
	.addArgument(amountArgument)
	.addOption(devNetworkOption)
	.addOption(kyveApiUrlOption)
	.addOption(kyvePoolIdOption)
	.addOption(privateKeyOption)
	.action(async (amountStr: string, options: Options) => {
		const amount = BigInt(amountStr);

		// if (options.devNetwork) {
		// 	if (!options.kyveApiUrl) {
		// 		console.error(
		// 			`${kyveApiUrlOption.name()} is required when initializing on DevNetwork`
		// 		);
		// 		process.exit(1);
		// 	}
		// 	if (!options.kyvePoolId) {
		// 		console.error(
		// 			`${kyvePoolIdOption.name()} is required when initializing on DevNetwork`
		// 		);
		// 		process.exit(1);
		// 	}
		// 	await waitForKyve(options.kyveApiUrl, options.kyvePoolId);
		// }

		const { logStoreClient, streamrClient } = getClients(
			options.privateKey,
			options.devNetwork
		);
		const pulse = new Pulse(logStoreClient, streamrClient);
		await pulse.createStream(amount);
	});
