import { RecoveryRequest } from '@logsn/protocol';
import { Logger, MetricsContext, RateMetric } from '@streamr/utils';
import { json, Request, RequestHandler, Response } from 'express';

import { HttpServerEndpoint } from '../../Plugin';
import { StreamPublisher } from '../../shared/StreamPublisher';
import { createBasicAuthenticatorMiddleware } from './authentication';
import { RollCall } from './RollCall';

const logger = new Logger(module);

const createHandler = (
	streamPublisher: StreamPublisher,
	rollCall: RollCall
): RequestHandler => {
	return async (req: Request, res: Response) => {
		const { requestId } = req.body;

		const recoveryRequest = new RecoveryRequest({ requestId });
		await streamPublisher.publish(recoveryRequest.serialize());
		logger.trace(
			'Published RecoveryRequest: %s',
			JSON.stringify(recoveryRequest)
		);

		res.json(rollCall.aliveBrokers);
	};
};

export const createRecoveryEndpoint = (
	streamPublisher: StreamPublisher,
	rollCall: RollCall,
	metricsContext: MetricsContext
): HttpServerEndpoint => {
	const metrics = {
		recoveryRequestsPerSecond: new RateMetric(),
	};
	metricsContext.addMetrics('broker.plugin.logstore', metrics);
	return {
		path: `/recovery`,
		method: 'post',
		requestHandlers: [
			json(),
			createBasicAuthenticatorMiddleware(),
			createHandler(streamPublisher, rollCall),
		],
	};
};
