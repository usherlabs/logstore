import { Command } from 'commander';

import { Heartbeat } from '../../Heartbeat';
import { getClient } from '../../utils/getClient';
import { devNetworkOption, privateKeyOption } from '../options';

interface Options {
	devNetwork: boolean;
	privateKey: string;
}

export const startCommand = new Command('start')
	.description('Start LogStore Heartbeat')
	.addOption(devNetworkOption)
	.addOption(privateKeyOption)
	.action(async (options: Options) => {
		const client = getClient(options.privateKey, options.devNetwork);
		const heartbeat = new Heartbeat(client);
		await heartbeat.init();
		await heartbeat.start();
	});
