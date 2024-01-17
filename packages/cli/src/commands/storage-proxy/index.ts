import { Command } from '@commander-js/extra-typings';

import { storageProxyInit } from './storage-proxy-init';
import { storageProxyJoin } from './storage-proxy-join';

export const storageProxyCommand = new Command()
	.command('storage-proxy')
	.description('Manage Log Store StorageProxy')
	.addCommand(storageProxyInit)
	.addCommand(storageProxyJoin);
