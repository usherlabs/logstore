import { filter, Observable } from 'rxjs';


// Type guard predicate
type FilterFunction<T, R extends T> = (value: T) => value is R;

type FilterDictionary<T> = {
	[key: string]: FilterFunction<T, any>;
};

type ResultingObservables<T, FD extends FilterDictionary<T>> = {
	[K in keyof FD]: Observable<
		FD[K] extends FilterFunction<T, infer R> ? R : never
	>;
};

/**
 * Applies a dictionary of filter predicates on the source observable and returns an object of observables.
 *
 * @param source - Source observable.
 * @param filters - A dictionary of filter predicates.
 * @returns An object of observables with keys corresponding to the dictionary.
 */
export function switchPartition<T, FD extends FilterDictionary<T>>(
	source: Observable<T>,
	filters: FD
): ResultingObservables<T, FD> {
	const keys = Object.keys(filters) as Array<keyof FD>;
	return keys.reduce((acc, key) => {
		acc[key] = source.pipe(filter(filters[key]));
		return acc;
	}, {} as any);
}
