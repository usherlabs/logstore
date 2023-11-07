import { QueryPropagate, QueryRequest, QueryResponse } from '@logsn/protocol';
import { toEthereumAddress } from '@streamr/utils';
import { combineLatest, filter, first, map, Observable, switchMap } from 'rxjs';

import { SystemMessageValue } from '../SystemMessageObservable';
import {
	getExpectedPropagatedMessages,
	getMissingPropagatedMessages,
} from './handlePropagatedMessages';
import { rethrowErrorWithSourceActionName } from './utils';

export function checkCollectionCompletion({
	expectedNodes$,
	propagates$,
	request$,
	responses$,
}: {
	propagates$: Observable<SystemMessageValue<QueryPropagate>[]>;
	request$: Observable<SystemMessageValue<QueryRequest>>;
	responses$: Observable<SystemMessageValue<QueryResponse>[]>;
	expectedNodes$: Observable<string[]>;
}) {
	// We're done collecting when:
	// - We have the primary node's response, with publisherId
	// - We have messages from secondary nodes that are missing from the primary node
	// - We have propagates from these secondary nodes that have the missing messages
	// - We have all the responses from all the nodes that are expected to respond

	const primaryNodeResponse$ = combineLatest({
		responses: responses$,
		request: request$,
	}).pipe(
		map(({ request, responses }) =>
			responses.find(
				(response) =>
					response.message.requestPublisherId === request.metadata.publisherId
			)
		),
		// only one will serve, no need to keep subscribed
		first(Boolean),
		rethrowErrorWithSourceActionName(`getting primary node response`)
	);

	const secondaryNodeResponses$ = combineLatest({
		responses: responses$,
		request: request$,
	}).pipe(
		map(({ request, responses }) =>
			responses.filter(
				(response) =>
					response.message.requestPublisherId !== request.metadata.publisherId
			)
		)
	);

	const gotResponseFromAllNodes$ = combineLatest({
		responses: responses$,
		expectedNodes: expectedNodes$,
	}).pipe(
		map(({ responses, expectedNodes }) => {
			const responseNodes = responses.map(
				(response) => response.metadata.publisherId
			);
			return expectedNodes.every((expectedNode) =>
				responseNodes.includes(toEthereumAddress(expectedNode))
			);
		}),
		filter(Boolean)
	);

	const expectedPropagates$ = combineLatest({
		secondaryNodeResponses: secondaryNodeResponses$,
		primaryNodeResponse: primaryNodeResponse$,
	}).pipe(map(getExpectedPropagatedMessages));

	const missingPropagates$ = combineLatest({
		expectedPropagatedMessages: expectedPropagates$,
		propagates: propagates$,
	}).pipe(map(getMissingPropagatedMessages));

	const gotAllPropagates$ = missingPropagates$.pipe(
		map((missingPropagates) => missingPropagates.length === 0)
	);

	const allDone$ = gotResponseFromAllNodes$.pipe(
		// we're executing in order to short-circuit the process
		switchMap(() => gotAllPropagates$),
		first(Boolean),
		rethrowErrorWithSourceActionName(`checking collection completion`)
	);

	return allDone$;
}
