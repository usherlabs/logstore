import balanceCommand from '@/commands/store/store-balance';
import stakeCommand from '@/commands/store/store-stake';
import { Command } from '@commander-js/extra-typings';

export const storeCommand = new Command()
	.command('store')
	.description('Manage your Log Stores')
	.addCommand(balanceCommand)
	.addCommand(stakeCommand);
