import { program } from 'commander';
import 'dotenv/config';

import pkg from '../package.json';
import { initCommand, joinCommand } from './commands';
import { devNetworkOption, privateKeyOption } from './options';

program
	.version(pkg.version)
	.name(pkg.name)
	.description(pkg.description)
	.addOption(devNetworkOption)
	.addOption(privateKeyOption)
	.addCommand(initCommand)
	.addCommand(joinCommand)
	.parse(process.argv);
