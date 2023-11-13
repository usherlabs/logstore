import { QueryPropagate, QueryRequest, QueryResponse, SystemMessageType } from '@logsn/protocol';
import { toStreamID, toStreamPartID } from '@streamr/protocol';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, first, map, merge, Observable, share, shareReplay, tap } from 'rxjs';



import { HttpQueryFrom, HttpQueryLast, HttpQueryRange, QueryFromOptions, QueryLastOptions, QueryRangeOptions, QueryType } from '../../Queries';
import { switchPartition } from '../rxjs/switchPartition';
import { isSystemMessageOfType, SystemMessageValue } from '../SystemMessageObservable';
import { filterQueryPropagateMessages, filterQueryRequestMessages, filterQueryResponseMessages } from './filterSystemMessageOperations';
import { QueryInputPayload } from './types';
import { rethrowErrorWithSourceActionName } from './utils';


/**
 * This function retrieves the filtered system messages.
 * The filtering is necessary because we only want to process the relevant messages and ignore the rest.
 */
export function retrieveFilteredSystemMessages(
	systemMessages$: Observable<SystemMessageValue>,
	queryNodeAddress$: Observable<string>,
	httpResponseRequestId$: Observable<string | null>,
	queryInput: QueryInputPayload
) {
	const impossibleRequestIds$ = new BehaviorSubject(new Set<string>());

	const { newQueryRequest$, newQueryResponse$, newQueryPropagate$ } =
		switchPartition(systemMessages$, {
			newQueryRequest$: isSystemMessageOfType(SystemMessageType.QueryRequest),
			newQueryResponse$: isSystemMessageOfType(SystemMessageType.QueryResponse),
			newQueryPropagate$: isSystemMessageOfType(
				SystemMessageType.QueryPropagate
			),
		});

	const filteredQueryRequest$ = filterQueryRequestMessages(
		newQueryRequest$,
		queryNodeAddress$,
		impossibleRequestIds$,
		httpResponseRequestId$
	).pipe(map((c) => c.message));
	const filteredQueryResponse$ = filterQueryResponseMessages(
		newQueryResponse$,
		queryNodeAddress$,
		impossibleRequestIds$,
		httpResponseRequestId$
	).pipe(map((c) => c.message));
	const filteredQueryPropagate$ = filterQueryPropagateMessages(
		newQueryPropagate$,
		queryNodeAddress$,
		impossibleRequestIds$,
		httpResponseRequestId$
	).pipe(map((c) => c.message));

	const resultingResponsesPool$ = new BehaviorSubject<
		SystemMessageValue<QueryResponse>[]
	>([]);
	const resultingPropagatesPool$ = new BehaviorSubject<
		SystemMessageValue<QueryPropagate>[]
	>([]);

	// side effect that fills the pools with new responses and propagates
	const fillPools$ = merge(
		fillPoolWithStream(filteredQueryResponse$, resultingResponsesPool$),
		fillPoolWithStream(filteredQueryPropagate$, resultingPropagatesPool$)
	);

	// this stream will help us filtering new impossible requestIds, once we uncover them
	// this happens only to decrease workload and memory usage
	const fillImpossibleRequestIdsWithIncompatibleInputs$ =
		filteredQueryRequest$.pipe(
			filter(hasIncompatibleQueryInput(queryInput)),
			tap(({ message }) =>
				impossibleRequestIds$.next(
					impossibleRequestIds$.getValue().add(message.requestId)
				)
			)
		);

	// side effect that shrinks the pools when we get a new http response, removing unnecessary responses and propagates
	// also reducing workload and memory usage
	const shrinkResultsOnRequestIdDefinition$ = merge(
		shrinkPoolOnHttpRequestIdDefinition$(
			httpResponseRequestId$,
			resultingResponsesPool$
		),
		shrinkPoolOnHttpRequestIdDefinition$(
			httpResponseRequestId$,
			resultingPropagatesPool$
		)
	);

	// if we don't start this Observable, it won't fill pools
	const startCollecting$ = merge(
		fillImpossibleRequestIdsWithIncompatibleInputs$,
		fillPools$,
		shrinkResultsOnRequestIdDefinition$
	).pipe(
		// even if used multiple times, we shouldn't run these side effects more than once, so we share the stream
		share({
			resetOnRefCountZero: true,
		})
	);

	const request$ = combineLatest({
		request: filteredQueryRequest$,
		requestId: httpResponseRequestId$,
	}).pipe(
		filter(({ requestId }) => requestId !== null),
		filter(({ request, requestId }) => request.message.requestId === requestId),
		map(({ request }) => request),
		// there may be only one request with this requestId, so we can take the first
		first(),
		rethrowErrorWithSourceActionName(`getting request`),
		shareReplay({
			refCount: true,
			bufferSize: 1,
		})
	);

	return {
		request$,
		responses$: resultingResponsesPool$,
		propagates$: resultingPropagatesPool$,
		startCollectingSystemMessages$: startCollecting$,
	};
}

const fillPoolWithStream = <
	T extends QueryResponse | QueryPropagate | QueryRequest,
>(
	src$: Observable<SystemMessageValue<T>>,
	pool$: BehaviorSubject<SystemMessageValue<T>[]>
) => src$.pipe(tap((newVal) => pool$.next(pool$.getValue().concat(newVal))));
/**
 * This mutates pool$, filtering out requestIds from it that shouldn't be here,
 * releasing from memory
 * @param requestId$
 * @param pool$
 */
const shrinkPoolOnHttpRequestIdDefinition$ = <
	T extends QueryRequest | QueryResponse | QueryPropagate,
>(
	requestId$: Observable<string | null>,
	pool$: BehaviorSubject<SystemMessageValue<T>[]>
) =>
	requestId$.pipe(
		distinctUntilChanged(),
		filter((requestId) => requestId !== null),
		tap((requestId) => {
			pool$.next(
				pool$.getValue().filter((c) => c.message.requestId === requestId)
			);
		})
	);

function hasIncompatibleQueryInput(
	queryInput: QueryInputPayload
): (msgValue: SystemMessageValue<QueryRequest>) => boolean {
	return (msgValue) => {
		const requestMessage = msgValue.message;
		if (queryInput.queryType !== requestMessage.queryType) {
			return true;
		}

		const getRequestPartitionId = (request: QueryRequest) => {
			const { partition, streamId } = request;
			return toStreamPartID(toStreamID(streamId), partition);
		};

		if (queryInput.streamPartId !== getRequestPartitionId(requestMessage)) {
			return true;
		}

		switch (queryInput.queryType) {
			case QueryType.Last:
				return (
					(queryInput.query as HttpQueryLast).count !==
					(requestMessage.queryOptions as QueryLastOptions).last
				);
			case QueryType.From:
				return (
					(queryInput.query as HttpQueryFrom).fromTimestamp !==
						(requestMessage.queryOptions as QueryFromOptions).from.timestamp ||
					(queryInput.query as HttpQueryFrom).fromSequenceNumber !==
						(requestMessage.queryOptions as QueryFromOptions).from
							.sequenceNumber ||
					(queryInput.query as HttpQueryFrom).publisherId !==
						(requestMessage.queryOptions as QueryFromOptions).publisherId
				);
			case QueryType.Range:
				return (
					(queryInput.query as HttpQueryRange).fromTimestamp !==
						(requestMessage.queryOptions as QueryRangeOptions).from.timestamp ||
					(queryInput.query as HttpQueryRange).toTimestamp !==
						(requestMessage.queryOptions as QueryRangeOptions).to.timestamp ||
					(queryInput.query as HttpQueryRange).fromSequenceNumber !==
						(requestMessage.queryOptions as QueryRangeOptions).from
							.sequenceNumber ||
					(queryInput.query as HttpQueryRange).toSequenceNumber !==
						(requestMessage.queryOptions as QueryRangeOptions).to
							.sequenceNumber ||
					(queryInput.query as HttpQueryRange).publisherId !==
						(requestMessage.queryOptions as QueryRangeOptions).publisherId ||
					(queryInput.query as HttpQueryRange).msgChainId !==
						(requestMessage.queryOptions as QueryRangeOptions).msgChainId
				);
		}
	};
}
