import { Command } from 'commander';

import { Heartbeat } from '../../Heartbeat';
import { getClient } from '../../utils/getClient';
import { waitForKyve } from '../../utils/waitForKyve';
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
	.description('Initialize LogStore Heartbeat stream')
	.addArgument(amountArgument)
	.addOption(devNetworkOption)
	.addOption(kyveApiUrlOption)
	.addOption(kyvePoolIdOption)
	.addOption(privateKeyOption)
	.action(async (amountStr: string, options: Options) => {
		const amount = BigInt(amountStr);

		if (options.devNetwork) {
			if (!options.kyveApiUrl) {
				console.error(
					`${kyveApiUrlOption.name()} is required when initializing on DevNetwork`
				);
				process.exit(1);
			}
			if (!options.kyvePoolId) {
				console.error(
					`${kyvePoolIdOption.name()} is required when initializing on DevNetwork`
				);
				process.exit(1);
			}
			await waitForKyve(options.kyveApiUrl, options.kyvePoolId);
		}

		const client = getClient(options.privateKey, options.devNetwork);
		const heartbeat = new Heartbeat(client);
		await heartbeat.createStream(amount);
	});
