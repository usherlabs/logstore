/**
 * Endpoints for RESTful data requests
 */
import { QueryRequest, QueryType } from '@logsn/protocol';
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
import { pipeline, Readable } from 'stream';
import { v4 as uuid } from 'uuid';

import { StrictConfig } from '../../../config/config';
import { HttpServerEndpoint } from '../../../Plugin';
import { createBasicAuthenticatorMiddleware } from '../authentication';
import { ConsensusResponse } from '../Consensus';
import { ConsensusManager } from '../ConsensusManger';
import { LogStore } from '../LogStore';
import { Format, getFormat } from './DataQueryFormat';
import {
	MessageLimitTransform,
	ResponseTransform,
	StreamResponseTransform,
} from './dataTransformers';
import { getMessageLimitForRequest } from './messageLimiter';
import { isStreamRequest } from './utils';

const logger = new Logger(module);

let seqNum: number = 0;

// TODO: move this to protocol-js
export const MIN_SEQUENCE_NUMBER_VALUE = 0;
export const MAX_SEQUENCE_NUMBER_VALUE = 2147483647;

function parseIntIfExists(x: string | undefined): number | undefined {
	return x === undefined ? undefined : parseInt(x);
}

const sendSuccess = (
	data: Readable,
	consensus: ConsensusResponse[],
	format: Format,
	version: number | undefined,
	streamId: string,
	req: Request,
	res: Response
) => {
	data.once('readable', () => {
		res.writeHead(200, {
			'Content-Type': isStreamRequest(req)
				? 'text/event-stream'
				: format.contentType,
			Consensus: JSON.stringify(consensus),
		});
	});
	data.once('error', () => {
		if (!res.headersSent) {
			res.status(500).json({
				error: 'Failed to fetch data!',
			});
		}
	});

	const responseTransform = isStreamRequest(req)
		? new StreamResponseTransform(format, version)
		: new ResponseTransform(format, version);

	const messageLimitForRequest = getMessageLimitForRequest(req);

	const messageLimitTransform = new MessageLimitTransform(
		messageLimitForRequest
	);

	messageLimitTransform.onMessageLimitReached(({ nextMessage }) => {
		if (responseTransform instanceof ResponseTransform) {
			responseTransform.setMetadata({
				hasNext: true,
				nextTimestamp: nextMessage.getTimestamp(),
			});
		}
	});

	pipeline(data, messageLimitTransform, responseTransform, res, (err) => {
		if (err !== undefined && err !== null) {
			logger.error(`Pipeline error in DataQueryEndpoints: ${streamId}`, err);
		}
	});
};

const sendError = (message: string, res: Response) => {
	logger.error(message);
	res.status(400).json({
		error: message,
	});
};

type BaseRequest<Q> = Request<
	Record<string, any>,
	any,
	any,
	Q,
	Record<string, any>
>;

type LastRequest = BaseRequest<{
	count?: string;
}>;

type FromRequest = BaseRequest<{
	fromTimestamp?: string;
	fromSequenceNumber?: string;
	publisherId?: string;
}>;

type RangeRequest = BaseRequest<{
	fromTimestamp?: string;
	toTimestamp?: string;
	fromSequenceNumber?: string;
	toSequenceNumber?: string;
	publisherId?: string;
	msgChainId?: string;
	fromOffset?: string; // no longer supported
	toOffset?: string; // no longer supported
}>;

export type QueryHttpRequest = LastRequest | FromRequest | RangeRequest;

const getCountForLastRequest = (req: LastRequest) => {
	const count =
		req.query.count === undefined ? 1 : parseIntIfExists(req.query.count) ?? 1;

	if (Number.isNaN(count)) {
		return 'NOT_A_NUMBER' as const;
	}

	// Added 1 because we want to know later if there are more events, so we
	// may add a metadata field to the response
	const messageLimitForARequest = getMessageLimitForRequest(req) + 1;

	return Math.min(count, messageLimitForARequest);
};

const getDataForLastRequest = async (
	req: LastRequest,
	streamId: string,
	partition: number,
	res: Response,
	logStore: LogStore,
	consensusManager: ConsensusManager,
	metrics: MetricsDefinition
) => {
	metrics.resendLastQueriesPerSecond.record(1);
	const count = getCountForLastRequest(req);
	if (count === 'NOT_A_NUMBER') {
		sendError(`Query parameter "count" not a number: ${req.query.count}`, res);
		return;
	}

	const requestId = uuid();
	const queryMessage = new QueryRequest({
		seqNum: seqNum++,
		requestId,
		consumerId: req.consumer!,
		streamId,
		partition,
		queryType: QueryType.Last,
		queryOptions: {
			last: count,
		},
	});
	const consensus = await consensusManager.getConsensus(queryMessage);

	const data = logStore.requestLast(streamId, partition, count!);
	return { data, consensus };
};

const getDataForFromRequest = async (
	req: FromRequest,
	streamId: string,
	partition: number,
	res: Response,
	logStore: LogStore,
	consensusManager: ConsensusManager,
	metrics: MetricsDefinition
) => {
	metrics.resendFromQueriesPerSecond.record(1);
	const fromTimestamp = parseIntIfExists(req.query.fromTimestamp);
	const fromSequenceNumber =
		parseIntIfExists(req.query.fromSequenceNumber) || MIN_SEQUENCE_NUMBER_VALUE;
	const { publisherId } = req.query;
	if (fromTimestamp === undefined) {
		sendError('Query parameter "fromTimestamp" required.', res);
		return;
	}
	if (Number.isNaN(fromTimestamp)) {
		sendError(
			`Query parameter "fromTimestamp" not a number: ${req.query.fromTimestamp}`,
			res
		);
		return;
	}

	// Added 1 because we want to know later if there are more events, so we
	// may add a metadata field to the response
	const messageLimitForRequest = getMessageLimitForRequest(req) + 1;
	const limitOrUndefinedIfInfinity = isFinite(messageLimitForRequest)
		? messageLimitForRequest
		: undefined;

	const requestId = uuid();
	const queryMessage = new QueryRequest({
		seqNum: seqNum++,
		requestId,
		consumerId: req.consumer!,
		streamId,
		partition,
		queryType: QueryType.From,
		queryOptions: {
			from: {
				timestamp: fromTimestamp,
				sequenceNumber: fromSequenceNumber,
			},
			limit: limitOrUndefinedIfInfinity,
			publisherId,
		},
	});

	const consensus = await consensusManager.getConsensus(queryMessage);

	const data = logStore.requestFrom(
		streamId,
		partition,
		fromTimestamp,
		fromSequenceNumber,
		publisherId,
		limitOrUndefinedIfInfinity
	);
	return { data, consensus };
};

const getDataForRangeRequest = async (
	req: RangeRequest,
	streamId: string,
	partition: number,
	res: Response,
	logStore: LogStore,
	consensusManager: ConsensusManager,
	metrics: MetricsDefinition
) => {
	metrics.resendRangeQueriesPerSecond.record(1);
	const fromTimestamp = parseIntIfExists(req.query.fromTimestamp);
	const toTimestamp = parseIntIfExists(req.query.toTimestamp);
	const fromSequenceNumber =
		parseIntIfExists(req.query.fromSequenceNumber) || MIN_SEQUENCE_NUMBER_VALUE;
	const toSequenceNumber =
		parseIntIfExists(req.query.toSequenceNumber) || MAX_SEQUENCE_NUMBER_VALUE;
	const { publisherId, msgChainId } = req.query;
	if (req.query.fromOffset !== undefined || req.query.toOffset !== undefined) {
		sendError(
			'Query parameters "fromOffset" and "toOffset" are no longer supported. Please use "fromTimestamp" and "toTimestamp".',
			res
		);
		return;
	}
	if (fromTimestamp === undefined) {
		sendError('Query parameter "fromTimestamp" required.', res);
		return;
	}
	if (Number.isNaN(fromTimestamp)) {
		sendError(
			`Query parameter "fromTimestamp" not a number: ${req.query.fromTimestamp}`,
			res
		);
		return;
	}
	if (toTimestamp === undefined) {
		// eslint-disable-next-line max-len
		sendError(
			'Query parameter "toTimestamp" required as well. To request all messages since a timestamp, use the endpoint /streams/:id/data/partitions/:partition/from',
			res
		);
		return;
	}
	if (Number.isNaN(toTimestamp)) {
		sendError(
			`Query parameter "toTimestamp" not a number: ${req.query.toTimestamp}`,
			res
		);
		return;
	}
	if ((publisherId && !msgChainId) || (!publisherId && msgChainId)) {
		sendError('Invalid combination of "publisherId" and "msgChainId"', res);
		return;
	}

	// Added 1 because we want to know later if there are more events, so we
	// may add a metadata field to the response
	const messageLimitForRequest = getMessageLimitForRequest(req) + 1;
	const limitOrUndefinedIfInfinity = isFinite(messageLimitForRequest)
		? messageLimitForRequest
		: undefined;

	const requestId = uuid();
	const queryMessage = new QueryRequest({
		seqNum: seqNum++,
		requestId,
		consumerId: req.consumer!,
		streamId,
		partition,
		queryType: QueryType.Range,
		queryOptions: {
			from: {
				timestamp: fromTimestamp,
				sequenceNumber: fromSequenceNumber,
			},
			to: {
				timestamp: toTimestamp,
				sequenceNumber: toSequenceNumber,
			},
			limit: limitOrUndefinedIfInfinity,
			publisherId,
			msgChainId,
		},
	});

	const consensus = await consensusManager.getConsensus(queryMessage);

	const data = logStore.requestRange(
		streamId,
		partition,
		fromTimestamp,
		fromSequenceNumber,
		toTimestamp,
		toSequenceNumber,
		publisherId,
		msgChainId,
		limitOrUndefinedIfInfinity
	);
	return { data, consensus };
};

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
	...args: Parameters<
		| typeof getDataForLastRequest
		| typeof getDataForFromRequest
		| typeof getDataForRangeRequest
	>
) => {
	const [req, streamId, partition, res, logStore, consensusManager, metrics] =
		args;
	const rest = [
		streamId,
		partition,
		res,
		logStore,
		consensusManager,
		metrics,
	] as const;
	const reqType = getRequestType(req);
	switch (reqType.type) {
		case 'last':
			return getDataForLastRequest(reqType.req, ...rest);
		case 'from':
			return getDataForFromRequest(reqType.req, ...rest);
		case 'range':
			return getDataForRangeRequest(reqType.req, ...rest);
		default:
			throw new Error(`Unknown query type: ${reqType}`);
	}
};

const createHandler = (
	config: Pick<StrictConfig, 'client'>,
	logStore: LogStore,
	consensusManager: ConsensusManager,
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
				req,
				streamId,
				partition,
				res,
				logStore,
				consensusManager,
				metrics
			);
			if (response) {
				sendSuccess(
					response.data,
					response.consensus,
					format,
					version,
					streamId,
					req,
					res
				);
			}
		} catch (error) {
			sendError(error, res);
		}
	};
};

export const createDataQueryEndpoint = (
	config: Pick<StrictConfig, 'client'>,
	logStore: LogStore,
	consensusManager: ConsensusManager,
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
			createHandler(config, logStore, consensusManager, metrics),
		],
	};
};
