import { program } from 'commander';

import pkg from '../package.json';
import { initCommand, startCommand } from '../src/cli';

program
	.version(pkg.version)
	.name('logstore-heartbeat')
	.description(pkg.description)
	.addCommand(initCommand)
	.addCommand(startCommand)
	.parse(process.argv);
