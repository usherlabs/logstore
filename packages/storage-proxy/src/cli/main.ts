import { program } from 'commander';
import 'dotenv/config';

import pkg from '../../package.json';
import { addNodeCommand, createCommand, dropCommand, removeNodeCommand } from './commands';
import { devNetworkOption, privateKeyOption } from './options';

program
	.version(pkg.version)
	.name(pkg.name)
	.description(pkg.description)
	.addOption(devNetworkOption)
	.addOption(privateKeyOption)
	.addCommand(createCommand)
	.addCommand(addNodeCommand)
	.addCommand(removeNodeCommand)
	.addCommand(dropCommand)
	.parse(process.argv);
