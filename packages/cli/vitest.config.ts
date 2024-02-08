import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	esbuild: {
		target: 'es2020',
		include: /\.(m?[jt]s|[jt]sx)$/,
		exclude: [],
	},
	test: {
		environment: 'node',
		setupFiles: ['dotenv/config', 'disposablestack/auto'],
	},
});
