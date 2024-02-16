import { Command } from 'commander';

import { Pulse } from '../../Pulse';
import { getClients } from '../../utils/getClient';
import { devNetworkOption, privateKeyOption } from '../options';

interface Options {
	devNetwork: boolean;
	privateKey: string;
}

export const startCommand = new Command('start')
	.description('Start LogStore Pulse')
	.addOption(devNetworkOption)
	.addOption(privateKeyOption)
	.action(async (options: Options) => {
		const { logStoreClient, streamrClient } = getClients(
			options.privateKey,
			options.devNetwork
		);
		const pulse = new Pulse(logStoreClient, streamrClient);
		await pulse.init();
		await pulse.start();
	});
