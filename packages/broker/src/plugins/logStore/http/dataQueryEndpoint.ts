/**
 * Endpoints for RESTful data requests
 */
import { getQueryManagerContract } from '@logsn/shared';
import {
	Logger,
	MetricsContext,
	MetricsDefinition,
	RateMetric,
	toEthereumAddress,
} from '@streamr/utils';
import { ethers } from 'ethers';
import { Request, RequestHandler, Response } from 'express';

import { StrictConfig } from '../../../config/config';
import { HttpServerEndpoint } from '../../../Plugin';
import { createBasicAuthenticatorMiddleware } from '../authentication';
import { logStoreContext } from '../context';
import { LogStore } from '../LogStore';
import { PropagationClient } from '../PropagationClient';
import { getFormat } from './DataQueryFormat';
import { getFromQueryRequest } from './getDataForRequest/getFromQueryRequest';
import { getLastQueryRequest } from './getDataForRequest/getLastQueryRequest';
import { getRangeQueryRequest } from './getDataForRequest/getRangeQueryRequest';
import { sendError, sendSuccess } from './httpHelpers';
import { FromRequest, LastRequest, RangeRequest } from './requestTypes';

const logger = new Logger(module);

// TODO: move this to protocol-js
export const MIN_SEQUENCE_NUMBER_VALUE = 0;
export const MAX_SEQUENCE_NUMBER_VALUE = 2147483647;

export function parseIntIfExists(x: string | undefined): number | undefined {
	return x === undefined ? undefined : parseInt(x);
}

/**
 * Determines the type of request based on the provided parameter.
 * Intention here is to befriend with TypeScript and make sure that the request
 * type is known at compile time.
 */
const getRequestType = (
	req: LastRequest | FromRequest | RangeRequest
):
	| { type: 'last'; req: LastRequest }
	| { type: 'from'; req: FromRequest }
	| { type: 'range'; req: RangeRequest } => {
	if (req.params.queryType === 'last') {
		return { type: 'last', req: req as LastRequest };
	} else if (req.params.queryType === 'from') {
		return { type: 'from', req: req as FromRequest };
	} else if (req.params.queryType === 'range') {
		return { type: 'range', req: req as RangeRequest };
	} else {
		throw new Error(`Unknown query type: ${req.params.queryType}`);
	}
};

const getDataForRequest = async (
	arg: Parameters<
		| typeof getLastQueryRequest
		| typeof getFromQueryRequest
		| typeof getRangeQueryRequest
	>[0],
	{ res }: { res: Response }
) => {
	const { req, ...rest } = arg;
	const reqType = getRequestType(req);
	let response;
	switch (reqType.type) {
		case 'last': {
			response = getLastQueryRequest({ req: reqType.req, ...rest });
			break;
		}
		case 'from': {
			response = getFromQueryRequest({ req: reqType.req, ...rest });
			break;
		}
		case 'range': {
			response = getRangeQueryRequest({ req: reqType.req, ...rest });
			break;
		}
		default:
			throw new Error(`Unknown query type: ${reqType}`);
	}

	if ('error' in response) {
		sendError(response.error?.message, res);
		return;
	} else {
		const store = logStoreContext.getStore();
		if (!store) {
			throw new Error('Used store before it was initialized');
		}

		const { queryRequestHandler } = store;

		queryRequestHandler.publishQueryRequest(response.queryRequest);
		const data = queryRequestHandler.processQueryRequest(response.queryRequest);

		return { data };
	}
};

const createHandler = (
	config: Pick<StrictConfig, 'client'>,
	logStore: LogStore,
	propagationClient: PropagationClient,
	metrics: MetricsDefinition
): RequestHandler => {
	return async (req: Request, res: Response) => {
		if (Number.isNaN(parseInt(req.params.partition))) {
			sendError(
				`Path parameter "partition" not a number: ${req.params.partition}`,
				res
			);
			return;
		}

		const format = getFormat(req.query.format as string | undefined);

		const consumer = toEthereumAddress(req.consumer!);
		const provider = new ethers.providers.JsonRpcProvider(
			config.client!.contracts?.streamRegistryChainRPCs!.rpcs[0]
		);
		const queryManager = await getQueryManagerContract(provider);
		const balance = await queryManager.balanceOf(consumer);
		if (!balance.gt(0)) {
			sendError('Not enough balance', res);
			return;
		}

		const streamId = req.params.id;
		const partition = parseInt(req.params.partition);
		const version = parseIntIfExists(req.query.version as string);
		try {
			const response = await getDataForRequest(
				{
					req,
					streamId,
					partition,
					metrics,
				},
				{
					res,
				}
			);
			if (response) {
				sendSuccess(response.data, format, version, streamId, req, res);
			}
		} catch (error) {
			sendError(error, res);
		}
	};
};

export const createDataQueryEndpoint = (
	config: Pick<StrictConfig, 'client'>,
	metricsContext: MetricsContext
): HttpServerEndpoint => {
	const metrics = {
		resendLastQueriesPerSecond: new RateMetric(),
		resendFromQueriesPerSecond: new RateMetric(),
		resendRangeQueriesPerSecond: new RateMetric(),
	};
	metricsContext.addMetrics('broker.plugin.logstore', metrics);
	return {
		path: `/streams/:id/data/partitions/:partition/:queryType`,
		method: 'get',
		requestHandlers: [
			createBasicAuthenticatorMiddleware(),
			createHandler(config, metrics),
		],
	};
};
