import { filter, mergeMap, type MonoTypeOperatorFunction, noop, Observable, type ObservableInput, operate, share } from 'rxjs';


/**
 * This operator is similar to takeUntil, but it also allows you to filter the source based on a predicate, and only
 * after that it subscribes to the notifier.
 *
 * @see {@link rxjs.takeUntil}
 */
export function takeUntilWithFilter<T>(
	predicate: (value: T, index: number) => boolean,
	notifier: ObservableInput<any>
): MonoTypeOperatorFunction<T> {
	return (source) =>
		new Observable((destination) => {
			// we share so both the filter and the notifier are subscribed to the same source
			const sharedSource = source.pipe(share());

			sharedSource
				.pipe(
					// filter the source based on the predicate, not emitting if the predicate returns false
					filter(predicate),
					// now we subscribe to the source, and that's the difference between takeUntil and takeUntilWithFilter
					// For example, if notifier is a timer, we don't want to start the timer until the predicate is true
					mergeMap(() => notifier)
				)
				.subscribe(
					operate({
						destination,
						// now we complete the destination when the notifier emits
						next: () => destination.complete(),
						complete: noop,
					})
				);
			!destination.closed && sharedSource.subscribe(destination);
		});
}
