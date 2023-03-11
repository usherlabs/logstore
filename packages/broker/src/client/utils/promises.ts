import pLimit from 'p-limit';

/**
 * Returns a function that executes with limited concurrency.
 */
export function pLimitFn<ArgsType extends unknown[], ReturnType>(
	fn: (...args: ArgsType) => ReturnType | Promise<ReturnType>,
	limit = 1
): ((...args: ArgsType) => Promise<ReturnType>) & { clear(): void } {
	const queue = pLimit(limit);
	return Object.assign((...args: ArgsType) => queue(() => fn(...args)), {
		clear() {
			queue.clearQueue();
		},
	});
}

// export class TimeoutError extends Error {
// 	public timeout: number;

// 	constructor(msg = '', timeout = 0) {
// 		super(`The operation timed out. ${timeout}ms. ${msg}`);
// 		this.timeout = timeout;
// 	}
// }

// /**
//  * Takes a promise and a timeout and an optional message for timeout errors.
//  * Returns a promise that rejects when timeout expires, or when promise settles, whichever comes first.
//  *
//  * Invoke with positional arguments for timeout & message:
//  * await pTimeout(promise, timeout, message)
//  *
//  * or using an options object for timeout, message & rejectOnTimeout:
//  *
//  * await pTimeout(promise, { timeout, message, rejectOnTimeout })
//  *
//  * message and rejectOnTimeout are optional.
//  */

// interface pTimeoutOpts {
// 	timeout?: number;
// 	message?: string;
// 	rejectOnTimeout?: boolean;
// }

// type pTimeoutArgs = [timeout?: number, message?: string] | [pTimeoutOpts];

// export async function pTimeout<T>(
// 	promise: Promise<T>,
// 	...args: pTimeoutArgs
// ): Promise<T | undefined> {
// 	let opts: pTimeoutOpts = {};
// 	if (args[0] && typeof args[0] === 'object') {
// 		[opts] = args;
// 	} else {
// 		[opts.timeout, opts.message] = args;
// 	}

// 	const { timeout = 0, message = '', rejectOnTimeout = true } = opts;

// 	if (typeof timeout !== 'number') {
// 		throw new Error(`timeout must be a number, got ${timeout}`);
// 	}

// 	let timedOut = false;
// 	const p = new Defer<undefined>();
// 	const t = setTimeout(() => {
// 		timedOut = true;
// 		if (rejectOnTimeout) {
// 			p.reject(new TimeoutError(message, timeout));
// 		} else {
// 			p.resolve(undefined);
// 		}
// 	}, timeout);
// 	p.catch(() => {});

// 	return Promise.race([
// 		Promise.resolve(promise).catch((err) => {
// 			clearTimeout(t);
// 			if (timedOut) {
// 				// ignore errors after timeout
// 				return undefined;
// 			}

// 			throw err;
// 		}),
// 		p,
// 	]).finally(() => {
// 		clearTimeout(t);
// 		p.resolve(undefined);
// 	});
// }

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
