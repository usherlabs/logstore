export const OUTPUT_DIR = process.env.OUTPUT_DIR;
export const TEST_TIMEOUT = Number(process.env.TEST_TIMEOUT || 120 * 1000); // milliseconds;
export const NUMBER_OF_ITERATIONS = Number(
	process.env.NUMBER_OF_ITERATIONS || 5
);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
