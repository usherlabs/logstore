import { RecoveryRequest } from '@logsn/protocol';
import { Logger, MetricsContext, RateMetric } from '@streamr/utils';
import { json, Request, RequestHandler, Response } from 'express';

import { HttpServerEndpoint } from '../../Plugin';
import { BroadbandPublisher } from '../../shared/BroadbandPublisher';
import { createBasicAuthenticatorMiddleware } from './authentication';
import { RollCall } from './RollCall';

const logger = new Logger(module);

const createHandler = (
	streamPublisher: BroadbandPublisher,
	rollCall: RollCall
): RequestHandler => {
	return async (req: Request, res: Response) => {
		const { requestId, from, to } = req.body;

		const recoveryRequest = new RecoveryRequest({ requestId, from, to });
		await streamPublisher.publish(recoveryRequest.serialize());
		logger.debug(
			'Published RecoveryRequest: %s',
			JSON.stringify(recoveryRequest)
		);

		res.json(rollCall.aliveBrokers);
	};
};

export const createRecoveryEndpoint = (
	streamPublisher: BroadbandPublisher,
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
