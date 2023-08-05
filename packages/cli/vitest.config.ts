import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";


// https://vitejs.dev/config/
export default defineConfig({
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	test: {
		environment: 'node',
		setupFiles: ['dotenv/config'],
	},
});
