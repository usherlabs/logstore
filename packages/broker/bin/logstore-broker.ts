#!/usr/bin/env node
import { program } from 'commander';

import pkg from '../package.json';
import { startCommand, testCommand } from '../src/cli';

program
	.version(pkg.version)
	.name('broker')
	.description('Manage and run LogStore Broker Node.')
	.addCommand(testCommand)
	.addCommand(startCommand)
	.parse(process.argv);
