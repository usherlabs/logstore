import * as T from 'effect';
import { Schedule } from 'effect';
import { retry, tryPromise } from 'effect/Effect';

/**
 * Retries an asynchronous function with a specified retry strategy.
 *
 * @example
 * ```ts
 * // Define the retry mechanism with exponential backoff and max 10 seconds
 *
 * const backoffStrategy = Schedule.compose(
 * 	Schedule.exponential(200, 2),
 * 	Schedule.recurUpTo(Duration.seconds(10))
 * );
 *
 * await retryAsyncFnWithStrategy(
 * 	async () => trySomethingHere(),
 * 	backoffStrategy
 * );
 * ```
 */
export const retryAsyncFnWithStrategy = <A>(
	fn: () => Promise<A>,
	strategy: Schedule.Schedule<never, any, any>
) => {
	return T.Effect.runPromise(tryPromise(() => fn()).pipe(retry(strategy)));
};
