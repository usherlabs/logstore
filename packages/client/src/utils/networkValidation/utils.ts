import {
	catchError,
	defer,
	filter,
	first,
	map,
	type MonoTypeOperatorFunction,
	Observable,
	share,
	shareReplay,
	tap,
	throwError,
} from 'rxjs';

import type { RequestMetadata } from '../../HttpUtil';
import { NodeManager } from '../../registry/NodeManager';

export const nodeAddressFromUrl = (url: string, nodeManager: NodeManager) =>
	defer(() => nodeManager.getNodeAddressFromUrl(url)).pipe(share());

export function tapDebugComplete<T>(name: string) {
	return tap<T>({
		complete: () => console.log(`COMPLETE ${name}`),
		unsubscribe: () => console.log(`UNSUBSCRIBE ${name}`),
		error: (err) => console.log(`ERROR ${name}`, err),
		finalize: () => console.log(`FINALIZE ${name}`),
		subscribe: () => console.log(`SUBSCRIBE ${name}`),
		next: (value) => {
			console.log(`NEXT ${name}`, value);
		},
	});
}

export function lowercaseRequestidFromLogstoreMetadata(
	stream: Observable<RequestMetadata>
): Observable<string> {
	return stream.pipe(
		map((m) => m.requestId),
		// should error if completed without a value.
		filter((val): val is string => !!val),
		first(),
		rethrowErrorWithSourceActionName(`getting request id from logstore stream`),
		map((val) => val.toLowerCase()),
		shareReplay({
			refCount: true,
			bufferSize: 1,
		})
	);
}

export function rethrowErrorWithSourceActionName<T>(
	actionName: string
): MonoTypeOperatorFunction<T> {
	return catchError((error) => {
		const originalMessage =
			'message' in error
				? error.message
				: typeof error === 'string'
				? error
				: '';
		return throwError(() =>
			// we don't want to add the action name if it's already there, to preserve the original source
			originalMessage.startsWith('Error while')
				? error
				: new Error(`Error while ${actionName}: ${originalMessage}`)
		);
	});
}
