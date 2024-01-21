import { program } from 'commander';
import 'dotenv/config';

import pkg from '../../package.json';
import { createCommand, dropCommand, joinCommand, leaveCommand } from './commands';
import { devNetworkOption, privateKeyOption } from './options';

program
	.version(pkg.version)
	.name(pkg.name)
	.description(pkg.description)
	.addOption(devNetworkOption)
	.addOption(privateKeyOption)
	.addCommand(createCommand)
	.addCommand(joinCommand)
	.addCommand(leaveCommand)
	.addCommand(dropCommand)
	.parse(process.argv);
