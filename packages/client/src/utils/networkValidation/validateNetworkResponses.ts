import { Logger } from '@streamr/utils';
import { catchError, combineLatest, concat, defer, first, firstValueFrom, map, race, share, startWith, switchMap, throwError, timer, toArray } from 'rxjs';



import { LogStoreMessageStream } from '../../LogStoreMessageStream';
import { NodeManager } from '../../registry/NodeManager';
import { SystemMessageObservable } from '../SystemMessageObservable';
import { checkCollectionCompletion } from './checkCollectionCompletion';
import { convertToStorageMatrix, nodesAgreeOnStorageMatrix, verifyMessagePresenceInStorageMatrix } from './manageStorageMatrix';
import { retrieveFilteredSystemMessages } from './retrieveFilteredSystemMessages';
import { QueryInputPayload } from './types';
import { lowercaseRequestidFromLogstoreStream, nodeAddressFromUrl, rethrowErrorWithSourceActionName } from './utils';


/**
 * This function orchestrates the process of validating network responses against expected results.
 *
 * 1. **Message Retrieval**: The function starts by retrieving relevant system messages to this query indefinetely.
 * 2. **Collection Completion Check**: During retrieval, the function checks if the collection is complete.
 * 3. **Storage Matrix Creation**: If the collection is complete, the function converts the responses into a structured storage matrix.
 * 4. **Matrix Consistency Check**: The function then checks if all nodes agree on the storage matrix.
 * 5. **Response Verification**: Finally, the function verifies if all the messages from the HTTP response are present in the storage matrix.
 *
 * If all these steps are completed successfully within a certain timeout period, the function returns true, indicating that the network responses are valid.
 * If any of these steps are not completed within the timeout period, an error is thrown, indicating that the network verification has timed out.
 */

export const validateWithNetworkResponses = ({
	queryInput,
	queryUrl,
	logger,
	nodeManager,
	systemMessages$,
	responseStream,
}: {
	queryInput: QueryInputPayload;
	logger: Logger;
	queryUrl: string;
	nodeManager: NodeManager;
	responseStream: LogStoreMessageStream;
	systemMessages$: SystemMessageObservable;
}) => {
	const queryNodeAddress$ = nodeAddressFromUrl(queryUrl, nodeManager).pipe(
		map((address) => address.toLowerCase())
	);

	const participatingNodesExtractedFromContract$ = defer(() =>
		nodeManager.getActiveNodes()
	);
	const participatingNodesExtractedFromResponse$ =
		responseStream.metadataStream.pipe(
			map((s) => s.participatingNodesAddress),
			// we expect it to be present always, when using this function
			first(Boolean),
			rethrowErrorWithSourceActionName(
				`getting participating nodes from response`
			)
		);

	/**
	 * first will be the ones from contract, as this is quicker to fetch.
	 * we want this intermediary value to already filter responses from network.
	 *
	 * then, from the http response we may get the final answer, the addresses
	 * that the query node really considered for answering.
	 *
	 * edge cases expect more nodes on contract than the ones present on response.
	 * this is important, else we would filter out possible responses.
	 */
	const activeNodeAddresses$ = concat(
		participatingNodesExtractedFromContract$,
		participatingNodesExtractedFromResponse$
	).pipe(share({ resetOnRefCountZero: true }));

	const httpResponseRequestId$ = lowercaseRequestidFromLogstoreStream(
		responseStream
	).pipe(
		// as we start this process in parallel, before getting the response from Query Node
		// we will start it with null, not filtering values by this matter until we have one
		startWith(null)
	);

	const { propagates$, request$, responses$, startCollectingSystemMessages$ } =
		retrieveFilteredSystemMessages(
			systemMessages$,
			queryNodeAddress$,
			httpResponseRequestId$,
			queryInput
		);

	// pipe from collection start, so we're sure to start the process from same observable
	const doneCollectingSystemMessages$ = startCollectingSystemMessages$.pipe(
		switchMap(() =>
			checkCollectionCompletion({
				propagates$: propagates$,
				responses$: responses$,
				expectedNodes$: activeNodeAddresses$,
				request$: request$,
			})
		),
		// only emits once, when done
		first((isDone) => isDone),
		rethrowErrorWithSourceActionName(`checking collection completion`)
	);

	// once we're done collecting, get the responses into a storage matrix
	const storageMatrix$ = doneCollectingSystemMessages$.pipe(
		// collecting is done, so we start the next part that is handling responses
		switchMap(() => responses$),
		map(convertToStorageMatrix),
		share({ resetOnRefCountZero: true })
	);

	const nodesAgreeOnMatrix$ = storageMatrix$.pipe(
		map(nodesAgreeOnStorageMatrix),
		// should error if completed without a value.
		// also, will stop on first because we only get a value once we're done collecting
		first(Boolean)
	);

	const messagesFromHttpResponse$ = responseStream
		.asObservable()
		.pipe(toArray());

	const allMessagesArePresentInStorageMatrix$ = combineLatest({
		messagesFromHttpResponse: messagesFromHttpResponse$,
		storageMatrix: storageMatrix$,
	}).pipe(map(verifyMessagePresenceInStorageMatrix));

	const conditionsWereValidated$ = combineLatest([
		allMessagesArePresentInStorageMatrix$,
		nodesAgreeOnMatrix$,
	]).pipe(
		map((values) => values.every(Boolean)),
		first(Boolean)
	);

	const timeoutError$ = combineLatest({
		// combining values from each so that we can log or even return this value if desired
		propagates: propagates$,
		request: request$,
		responses: responses$,
		// timeout: 5 seconds
		timer: timer(5000),
	}).pipe(
		map(({ timer: _timer, ..._rest }) => {
			// this maybe useful for debugging, however it is too verbose for production (?)
			// logger.error('Timeout error', rest);
			throw new Error('Network verification timed out');
		})
	);

	return firstValueFrom(
		race(conditionsWereValidated$, timeoutError$).pipe(
			catchError((error) => {
				logger.error(error.message);
				return throwError(error);
			})
		)
	);
};
