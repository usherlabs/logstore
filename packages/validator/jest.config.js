/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest/presets/js-with-ts',
	testEnvironment: 'node',
	clearMocks: true,
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.jest.json',
			diagnostics: {
				exclude: ['**'],
			},
		},
	},
	setupFilesAfterEnv: ['jest-extended/all'],
	transformIgnorePatterns: ['^.+\\.js$'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],
	testTimeout: 30000,
};
