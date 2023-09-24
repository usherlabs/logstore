import { Command } from '@commander-js/extra-typings';

import queryBalanceCommand from './query-balance';
import queryStakeCommand from './query-stake';

export const queryCommand = new Command()
	.command('query')
	.description('Manage your Log Store Queries')
	.addCommand(queryBalanceCommand)
	.addCommand(queryStakeCommand);
