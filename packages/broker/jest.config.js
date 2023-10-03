// we must use require here because the OTelEnvironment needs some env vars
const { config } = require('dotenv');
config();

/** @type {import("ts-jest").JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest/presets/js-with-ts',
	testEnvironment: './test/OTelEnvironment.ts',
	clearMocks: true,
	// can't use prettier 3 with jest
	prettierPath: require.resolve('prettier-2'),
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.jest.json',
		},
	},
	setupFiles: ['dotenv/config'],
	setupFilesAfterEnv: ['jest-extended/all'],
};
