import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// load env variables
		watch: false,
		setupFiles: 'dotenv/config',
		include: ['./src/**/*.benchmark.ts'],
		testTimeout: 220_000,
	},
});
