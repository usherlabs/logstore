const { config } = require('@swc/core/spack');

module.exports = config({
	entry: {
		web: __dirname + '/src/index.ts',
	},
	output: {
		path: __dirname + '/build',
	},
	target: 'node',
	externalModules: [
		'aws-sdk',
		'@lit-protocol/lit-node-client',
		'node-datachannel',
	],
});
