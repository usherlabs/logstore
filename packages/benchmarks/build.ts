import esbuild from "esbuild";
import { globby } from "globby";
import { Logger } from "tslog";


// necessary:
// CLI tool at src/cli/index.ts
// vitest tests at src/**/*.benchmark.ts
const logger = new Logger();
const external = ['vitest', 'commander', 'chalk', '@streamr-client'];

const buildCli = async () => {
	await esbuild.build({
		entryPoints: ['src/cli/index.ts'],
		outdir: 'dist/bin',
		bundle: true,
		format: 'esm',
		// set env variables
		define: {
			'process.env.BUNDLED': '"true"',
		},
		platform: 'node',
		target: 'node16',
		external,
	});
};

const buildBenchmarks = async () => {
	const entryPoints = await globby(['src/**/*.benchmark.ts']);
	await esbuild.build({
		entryPoints,
		outdir: 'dist/benchmarks',
		bundle: true,
		format: 'esm',
		platform: 'node',
		target: 'node16',
		external,
	});
};

const build = async () => {
	await Promise.all([buildCli(), buildBenchmarks()]);

	logger.info('Build complete');
};

void build().then(() => process.exit(0));
