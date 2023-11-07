import { QueryPropagate, QueryRequest, QueryResponse } from '@logsn/protocol';
import { combineLatest, filter, Observable } from 'rxjs';

import { SystemMessageValue } from '../SystemMessageObservable';

type FilterSystemMessageCommonArgs<
	T extends QueryRequest | QueryResponse | QueryPropagate,
> = {
	systemMessage$: Observable<SystemMessageValue<T>>;
	queryNodeAddress$: Observable<string>;
	impossibleRequestIds$: Observable<Set<string>>;
	httpResponseRequestId$: Observable<string | null>;
	getRequestPublisherId: (message: SystemMessageValue<T>) => string;
};

/**
 * This function encapsulates the common filtering logic.
 * The order of the filters is important as it reduces the workload by filtering the most specific conditions first.
 */
const filterSystemMessageBasedOnCriteria = <
	T extends QueryRequest | QueryResponse | QueryPropagate,
>({
	systemMessage$,
	queryNodeAddress$,
	impossibleRequestIds$,
	httpResponseRequestId$,
	getRequestPublisherId,
}: FilterSystemMessageCommonArgs<T>) =>
	combineLatest({
		message: systemMessage$,
		queryNodeAddress: queryNodeAddress$,
		impossibleRequestIds: impossibleRequestIds$,
		httpResponseRequestId: httpResponseRequestId$,
	}).pipe(
		// select messages that match requestId from http response, if we already have it, otherwise filter impossible requests
		filter(({ httpResponseRequestId, message, impossibleRequestIds }) =>
			httpResponseRequestId === null
				? !impossibleRequestIds.has(message.message.requestId)
				: message.message.requestId === httpResponseRequestId
		),
		// select messages published from query node address
		filter(
			({ queryNodeAddress, message }) =>
				queryNodeAddress === getRequestPublisherId(message)
		)
	);

export const filterQueryRequestMessages = (
	request$: Observable<SystemMessageValue<QueryRequest>>,
	queryNodeAddress$: Observable<string>,
	impossibleRequestIds$: Observable<Set<string>>,
	httpResponseRequestId$: Observable<string | null>
) =>
	filterSystemMessageBasedOnCriteria({
		systemMessage$: request$,
		queryNodeAddress$,
		impossibleRequestIds$,
		httpResponseRequestId$,
		getRequestPublisherId: (v) => v.metadata.publisherId,
	});

export const filterQueryResponseMessages = (
	response$: Observable<SystemMessageValue<QueryResponse>>,
	queryNodeAddress$: Observable<string>,
	impossibleRequestIds$: Observable<Set<string>>,
	httpResponseRequestId$: Observable<string | null>
) =>
	filterSystemMessageBasedOnCriteria({
		systemMessage$: response$,
		queryNodeAddress$,
		impossibleRequestIds$,
		httpResponseRequestId$,
		getRequestPublisherId: (v) => v.message.requestPublisherId,
	});

export const filterQueryPropagateMessages = (
	propagate$: Observable<SystemMessageValue<QueryPropagate>>,
	queryNodeAddress$: Observable<string>,
	impossibleRequestIds$: Observable<Set<string>>,
	httpResponseRequestId$: Observable<string | null>
) =>
	filterSystemMessageBasedOnCriteria({
		systemMessage$: propagate$,
		queryNodeAddress$,
		impossibleRequestIds$,
		httpResponseRequestId$,
		getRequestPublisherId: (v) => v.message.requestPublisherId,
	});
