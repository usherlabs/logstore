#! /usr/bin/env node
// objective is to have a standalone runner in which we can transfer to a new environment and run something like:
// benchmark --config benchmark.config.ts --outDir ./results --streamrHost localhost
// config is not required
// outputDir default is ./results
import { Command } from 'commander';

import { runVitestBenchmarks } from './run-vitest-benchmarks';

const program = new Command();

program
	.command('run')
	.description('Run benchmarks')
	.option('-c, --config <string>', 'Config file - still not working')
	.option('-o, --outDir <string>', 'Output directory', './results')
	.option('-s, --streamrHost <string>', 'Streamr host', 'localhost')
	.option('-n, --numberOfIterations <number>', 'Number of iterations', '5')
	.option('-t, --testTimeout <number>', 'Test timeout in ms', '120000')
	.option(
		'-l, --logLevel <string>',
		'Log level: debug | info | warn | error | fatal | silent',
		'info'
	)
	.action(
		async (options: {
			config: string;
			outDir: string;
			streamrHost: string;
			numberOfIterations: number;
			testTimeout: number;
			logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
		}) => {
			await runVitestBenchmarks(options);
		}
	);

program.parse();
