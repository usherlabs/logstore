#!/usr/bin/env node
import { program } from 'commander';

import pkg from '../package.json';
import {
	delegateCommand,
	initCommand,
	joinCommand,
	leaveCommand,
	stakeCommand,
	startCommand,
	testCommand,
	undelegateCommand,
	withdrawCommand,
} from '../src/cli';

program
	.version(pkg.version)
	.name('logstore-broker')
	.description('Manage and run LogStore Broker Node.')
	.addCommand(initCommand)
	.addCommand(testCommand)
	.addCommand(joinCommand)
	.addCommand(startCommand)
	.addCommand(leaveCommand)
	.addCommand(stakeCommand)
	.addCommand(delegateCommand)
	.addCommand(undelegateCommand)
	.addCommand(withdrawCommand)
	.parse(process.argv);
