import { Stream } from '@logsn/client';
import { RecoveryRequest } from '@logsn/protocol';
import { Logger, MetricsContext, RateMetric } from '@streamr/utils';
import { json, Request, RequestHandler, Response } from 'express';

import { HttpServerEndpoint } from '../../Plugin';
import { createBasicAuthenticatorMiddleware } from './authentication';
import { RollCall } from './RollCall';

const logger = new Logger(module);

let seqNum: number = 0;

const createHandler = (
	systemStream: Stream,
	rollCall: RollCall
): RequestHandler => {
	return async (req: Request, res: Response) => {
		const { requestId, from, to } = req.body;

		const recoveryRequest = new RecoveryRequest({
			seqNum: seqNum++,
			requestId,
			from,
			to,
		});
		await systemStream.publish(recoveryRequest.serialize());
		logger.debug(
			'Published RecoveryRequest: %s',
			JSON.stringify(recoveryRequest)
		);

		res.json(rollCall.aliveBrokers);
	};
};

export const createRecoveryEndpoint = (
	systemStream: Stream,
	rollCall: RollCall,
	metricsContext: MetricsContext
): HttpServerEndpoint => {
	const metrics = {
		recoveryRequestsPerSecond: new RateMetric(),
	};
	metricsContext.addMetrics('broker.plugin.logStore', metrics);
	return {
		path: `/recovery`,
		method: 'post',
		requestHandlers: [
			json(),
			createBasicAuthenticatorMiddleware(),
			createHandler(systemStream, rollCall),
		],
	};
};
