export const tryInSequence = async <T>(
	fns: ((...args: any[]) => Promise<T>)[]
): Promise<T | never> => {
	if (fns.length === 0) {
		throw new Error('no tasks');
	}
	let firstError: any;
	for (const fn of fns) {
		try {
			const promise = fn();
			return await promise;
		} catch (e: any) {
			if (firstError === undefined) {
				firstError = e;
			}
		}
	}
	throw firstError;
};
