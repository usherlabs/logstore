// necessary to run before tests, otherwise arweave connection will fail
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	projects: ['<rootDir>'],
	preset: 'ts-jest/presets/js-with-ts',
	testEnvironment: 'node',
	clearMocks: true,
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.jest.json',
			diagnostics: {
				exclude: ['**'],
				include: ['test'],
			},
		},
	},
	setupFiles: ['dotenv/config'],
	setupFilesAfterEnv: ['jest-extended/all'],
	transformIgnorePatterns: ['^.+\\.js$'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],
	testTimeout: 30000,
};
