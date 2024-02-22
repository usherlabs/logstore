import { concatMap, defaultIfEmpty, defer, first, firstValueFrom, from, map } from 'rxjs';

/**
 * Returns a function that returns true if all of the functions return true in a short-circuiting manner
 * @param fns
 */
export const and =
	<T>(
		...fns: ((arg: T) => Promise<boolean> | boolean)[]
	): ((ctx: T) => Promise<boolean>) =>
	async (ctx: T) => {
		// better to run serially for short-circuiting
		for (const fn of fns) {
			if (!(await fn(ctx))) {
				return false;
			}
		}
		return true;
	};

/**
 * Returns a function that returns true if any of the functions return true in a short-circuiting manner
 * @param fns
 */
export const or =
	<T>(
		...fns: ((arg: T) => Promise<boolean> | boolean)[]
	): ((ctx: T) => Promise<boolean>) =>
	async (ctx: T) => {
		// better to run serially for short-circuiting
		for (const fn of fns) {
			if (await fn(ctx)) {
				return true;
			}
		}
		return false;
	};

/**
 * A generic record of error types and their filters to be applied to map an error to a type
 */
export type ErrorFilters<ErrorType extends string, ErrorObject> = Record<
	ErrorType,
	(err: ErrorObject) => boolean | Promise<boolean>
>;

/**
 * Returns the error type if any of the filters match the error
 * @param filters
 * @param err
 */
export const getErrorType = async <
	ErrorType extends string,
	ErrorObject,
	FilterRecord extends ErrorFilters<ErrorType, ErrorObject>,
>(
	filters: FilterRecord,
	err: ErrorObject
): Promise<ErrorType | undefined> => {
	const entries = Object.entries(filters) as Array<
		[ErrorType, (err: ErrorObject) => boolean]
	>;
	const errorType$ = from(entries).pipe(
		// short circuit on first match, execute in order
		concatMap(([type, filterFn]) =>
			defer(async () => filterFn(err)).pipe(
				first(Boolean),
				map(() => type as ErrorType)
			)
		),
		defaultIfEmpty(undefined)
	);

	return firstValueFrom(errorType$);
};
