import esbuild from 'esbuild';

// import { nodeExternalsPlugin } from 'esbuild-node-externals';
// import { nativeNodeModulesPlugin } from './native-node-modules';

(async () => {
	await esbuild.build({
		entryPoints: ['src/index.js'],
		bundle: true,
		platform: 'node',
		outfile: 'build/index.js',
		external: ['sqlite3', '@streamr/network-node', 'ipfs-utils'],
		plugins: [
			// nodeExternalsPlugin({
			// 	allowList: ['@kyvejs/protocol'],
			// }),
			// nativeNodeModulesPlugin(),
		],
	});

	console.log('Log Store Validator Node built successfully!');
})();
