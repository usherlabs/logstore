/**
 * Endpoints for RESTful data requests
 */
import { getQueryManagerContract } from '@logsn/shared';
import {
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
import { LogStoreContext, logStoreContext } from '../context';
import { getFormat } from './DataQueryFormat';
import { getForFromQueryRequest } from './getDataForRequest/getForFromQueryRequest';
import { getForLastQueryRequest } from './getDataForRequest/getForLastQueryRequest';
import { getForRangeQueryRequest } from './getDataForRequest/getForRangeQueryRequest';
import { sendError, sendSuccess } from './httpHelpers';
import { FromRequest, LastRequest, RangeRequest } from './requestTypes';

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
		| typeof getForLastQueryRequest
		| typeof getForFromQueryRequest
		| typeof getForRangeQueryRequest
	>[0],
	{ res }: { res: Response }
) => {
	const { req, ...rest } = arg;
	const reqType = getRequestType(req);
	let queryRequestBag;
	switch (reqType.type) {
		case 'last': {
			queryRequestBag = getForLastQueryRequest({ req: reqType.req, ...rest });
			break;
		}
		case 'from': {
			queryRequestBag = getForFromQueryRequest({ req: reqType.req, ...rest });
			break;
		}
		case 'range': {
			queryRequestBag = getForRangeQueryRequest({ req: reqType.req, ...rest });
			break;
		}
		default:
			throw new Error(`Unknown query type: ${reqType}`);
	}

	if ('error' in queryRequestBag) {
		sendError(queryRequestBag.error?.message, res);
		return;
	} else {
		const store = logStoreContext.getStore();
		if (!store) {
			throw new Error('Used store before it was initialized');
		}

		const { queryRequestManager } = store;

		await queryRequestManager.publishQueryRequestAndWaitForPropagateResolution(
			queryRequestBag.queryRequest
		);

		const data = queryRequestManager.getDataForQueryRequest(
			queryRequestBag.queryRequest
		);

		return { data };
	}
};

const createHandler = (
	config: Pick<StrictConfig, 'client'>,
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

function injectLogstoreContextMiddleware(
	ctx: LogStoreContext | undefined
): RequestHandler {
	return (_req, _res, next) => {
		ctx ? logStoreContext.run(ctx, () => next()) : () => next();
	};
}

export const createDataQueryEndpoint = (
	config: Pick<StrictConfig, 'client'>,
	metricsContext: MetricsContext
): HttpServerEndpoint => {
	const ctx = logStoreContext.getStore();
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
			// We need to inject it here, because the execution context from
			// below is usually created after the endpoint is created.
			injectLogstoreContextMiddleware(ctx),
			createBasicAuthenticatorMiddleware(),
			createHandler(config, metrics),
		],
	};
};
