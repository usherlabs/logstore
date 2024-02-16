import nodeResolvePlugin from '@esbuild-plugins/node-resolve';
import esbuild from 'esbuild';
import nodeExternalsPlugin from 'esbuild-node-externals';
import path from 'path';

const entryFile = path.resolve('./bin/logstore-cli.ts');
const outputFile = path.join(__dirname, 'dist/bin/logstore-cli.js');

const build = async () => {
	await esbuild.build({
		entryPoints: [entryFile],
		outfile: outputFile,
		// outdir: 'dist',
		bundle: true,
		platform: 'node',
		target: 'node12',
		sourcemap: 'inline',
		inject: ['./src/injects.ts'],
		plugins: [
			nodeExternalsPlugin(),
			nodeResolvePlugin({
				extensions: ['.ts', '.js'],
				onResolved: (resolved) => {
					if (resolved.includes('node_modules')) {
						return {
							external: true,
						};
					}
					return resolved;
				},
			}),
		],
	});
};

build()
	.then(() => {
		console.log('Build success!');
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
