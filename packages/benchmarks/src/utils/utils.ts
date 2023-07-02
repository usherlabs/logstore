// this is meant to fake a message of a certain size
// let's be aware that size may not be the only important factor to benchmark
// where it matters?
// - network bound (bandwidth) <- this one may be the most important factor, that's why is acceptable
// - memory bound (memory usage)
// - disk bound (disk usage)

export const generateMessageOfSize = (sizeInKb: number) => {
	const message = {
		content: 'x'.repeat(sizeInKb * 1024),
	};
	return message;
};

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
	return typeof obj === 'object' && obj !== null;
};
