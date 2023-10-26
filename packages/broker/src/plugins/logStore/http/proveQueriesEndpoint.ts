import { QueryMetadataRequest } from '@logsn/protocol';
import { Logger, MetricsContext, RateMetric } from '@streamr/utils';
import {
	json as expressJson,
	Request,
	RequestHandler,
	Response,
} from 'express';
import { Stream } from 'packages/client';

import { HttpServerEndpoint } from '../../../Plugin';
import { createBasicAuthenticatorMiddleware } from '../authentication';
import { logStoreContext } from '../context';

const logger = new Logger(module);

let seqNum: number = 0;

export type ProveQueriesResponse = {
	serializedMessage: string;
	requestCreationTimestamp: number;
	ableToRetryAtTimestamp: number;
};

export type ProveQueriesRequestBody = {
	to: number;
	from: number;
	requestId: string;
};

const createHandler = (_systemStream: Stream): RequestHandler => {
	return async (
		req: Request<any, any, ProveQueriesRequestBody>,
		res: Response
	) => {
		const { requestId, from, to } = req.body;

		const queryMetadataManager =
			logStoreContext.getStore()?.queryMetadataManager;
		if (!queryMetadataManager) {
			throw new Error('QueryMetadataManager not found in log store context');
		}

		const currentTimestamp = Date.now();
		/*
		 * Query Metadata requests are initiated by the validators trying to create Items for their current bundle.
		 * So they may start the process for the same keys, requesting many brokers.
		 *
		 * Then we created this mechanisms to throttle new requests, creating only if the cooldown is passed, in case
		 * there's already an active request for this key.
		 */
		const activeRequestForKey = queryMetadataManager.getActiveRequestForKey({
			to,
			from,
			requestCreatedAtTimestamp: currentTimestamp,
		});

		const queryMetadataRequest =
			activeRequestForKey?.currentActiveRequest?.[0] ??
			new QueryMetadataRequest({
				seqNum: seqNum++,
				requestId,
				from,
				to,
			});

		const serializedMessage = queryMetadataRequest.serialize();

		// no active request was found, so we may publish this new request
		// and also respond it appropriately
		if (!activeRequestForKey) {
			await _systemStream.publish(serializedMessage);
			logger.debug(
				'Published QueryMetadataRequest: %s',
				JSON.stringify(queryMetadataRequest)
			);
			await queryMetadataManager.processRequest(
				queryMetadataRequest,
				currentTimestamp
			);
		}

		const remainingCooldownInMs =
			activeRequestForKey?.remainingCooldownInMs ??
			queryMetadataManager.COOLDOWN_MS;

		res.json({
			serializedMessage: serializedMessage,
			// used to know if the validator joined the network after this request creation.
			// if that's the case, he will handle it as already failed, and retry it in a few time.
			requestCreationTimestamp:
				activeRequestForKey?.currentActiveRequest?.[1] ?? currentTimestamp,
			ableToRetryAtTimestamp: currentTimestamp + remainingCooldownInMs,
		} as ProveQueriesResponse);
	};
};

export const createProveQueriesEndpoint = (
	systemStream: Stream,
	metricsContext: MetricsContext
): HttpServerEndpoint => {
	const metrics = {
		queryMetadataRequestsPerSecond: new RateMetric(),
	};
	metricsContext.addMetrics('broker.plugin.logstore', metrics);
	return {
		path: `/prove/queries`,
		method: 'post',
		requestHandlers: [
			expressJson(),
			createBasicAuthenticatorMiddleware(),
			createHandler(systemStream),
		],
	};
};
