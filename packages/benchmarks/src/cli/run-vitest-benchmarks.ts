import chalk from 'chalk';
import path from 'path';
import { Logger } from 'tslog';
import { startVitest } from 'vitest/node';
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const projectRoot =
	process.env.BUNDLED === 'true' ? path.join(__dirname, '..') : process.cwd();

const logger = new Logger();
export const runVitestBenchmarks = async ({
	outDir,
	config,
	numberOfIterations,
	streamrHost,
}: {
	outDir: string;
	config: string;
	numberOfIterations: number;
	streamrHost: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
}) => {
	// todo remove when works
	logger.info('root', projectRoot);
	if (config) {
		logger.warn(chalk.yellow('Config file option still does nothing'));
	}

	const envs = {
		OUTPUT_DIR: outDir,
		NUMBER_OF_ITERATIONS: numberOfIterations?.toString(),
		STREAMR_DOCKER_DEV_HOST: streamrHost,
		LOG_LEVEL: 'info',
	};
	const vitest = await startVitest('test', undefined, {
		watch: false,
		// load env variables
		include: [`${projectRoot}/**/*.benchmark.?(c|m)[jt]s`],
		exclude: [],
		env: filterEmptyProperties(envs),
		testTimeout: 220_000,
	});
	return vitest?.close();
};

const filterEmptyProperties = <T extends object>(obj: T): Required<T> => {
	return Object.fromEntries(
		Object.entries(obj).filter(([_, v]) => v != null)
	) as Required<T>;
};
