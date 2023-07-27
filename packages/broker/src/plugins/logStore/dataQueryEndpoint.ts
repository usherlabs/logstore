/**
 * Endpoints for RESTful data requests
 */
import { LogStoreClient, Stream } from '@logsn/client';
import { LogStoreNodeManager } from '@logsn/contracts';
import { QueryRequest, QueryType } from '@logsn/protocol';
import { getNodeManagerContract, getQueryManagerContract } from '@logsn/shared';
import { StreamMessage } from '@streamr/protocol';
import {
	Logger,
	MetricsContext,
	MetricsDefinition,
	RateMetric,
	toEthereumAddress,
} from '@streamr/utils';
import { ethers } from 'ethers';
import { Request, RequestHandler, Response } from 'express';
import { pipeline, Readable, Transform } from 'stream';
import { v4 as uuid } from 'uuid';

import { StrictConfig } from '../../config/config';
import { HttpServerEndpoint } from '../../Plugin';
import { StreamPublisher } from '../../shared/StreamPublisher';
import { createBasicAuthenticatorMiddleware } from './authentication';
import { Consensus, getConsensus } from './Consensus';
import { Format, getFormat } from './DataQueryFormat';
import { LogStore } from './LogStore';

const logger = new Logger(module);

// TODO: move this to protocol-js
export const MIN_SEQUENCE_NUMBER_VALUE = 0;
export const MAX_SEQUENCE_NUMBER_VALUE = 2147483647;

class ResponseTransform extends Transform {
	format: Format;
	version: number | undefined;
	firstMessage = true;

	constructor(format: Format, version: number | undefined) {
		super({
			writableObjectMode: true,
		});
		this.format = format;
		this.version = version;
	}

	override _transform(
		input: StreamMessage,
		_encoding: string,
		done: () => void
	) {
		if (this.firstMessage) {
			this.firstMessage = false;
			this.push(this.format.header);
		} else {
			this.push(this.format.delimiter);
		}
		this.push(this.format.getMessageAsString(input, this.version));
		done();
	}

	override _flush(done: () => void) {
		if (this.firstMessage) {
			this.push(this.format.header);
		}
		this.push(this.format.footer);
		done();
	}
}

function parseIntIfExists(x: string | undefined): number | undefined {
	return x === undefined ? undefined : parseInt(x);
}

const sendSuccess = (
	data: Readable,
	consensus: Consensus[],
	format: Format,
	version: number | undefined,
	streamId: string,
	res: Response
) => {
	data.once('readable', () => {
		res.writeHead(200, {
			'Content-Type': format.contentType,
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
	pipeline(data, new ResponseTransform(format, version), res, (err) => {
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

const handleLast = async (
	req: LastRequest,
	streamId: string,
	partition: number,
	format: Format,
	version: number | undefined,
	res: Response,
	nodeManager: LogStoreNodeManager,
	logStore: LogStore,
	logStoreClient: LogStoreClient,
	systemStream: Stream,
	streamPublisher: StreamPublisher,
	metrics: MetricsDefinition
) => {
	metrics.resendLastQueriesPerSecond.record(1);
	const count =
		req.query.count === undefined ? 1 : parseIntIfExists(req.query.count) ?? 1;
	if (Number.isNaN(count)) {
		sendError(`Query parameter "count" not a number: ${req.query.count}`, res);
		return;
	}

	let data = logStore.requestLast(streamId, partition, count!);

	const requestId = uuid();
	const queryMessage = new QueryRequest({
		requestId,
		consumerId: req.consumer!,
		streamId,
		partition,
		queryType: QueryType.Last,
		queryOptions: {
			last: count,
		},
	});

	const consensus = await getConsensus(
		queryMessage,
		nodeManager,
		logStoreClient,
		systemStream,
		streamPublisher
	);

	data = logStore.requestLast(streamId, partition, count!);
	sendSuccess(data, consensus, format, version, streamId, res);
};

const handleFrom = async (
	req: FromRequest,
	streamId: string,
	partition: number,
	format: Format,
	version: number | undefined,
	res: Response,
	nodeManager: LogStoreNodeManager,
	logStore: LogStore,
	logStoreClient: LogStoreClient,
	systemStream: Stream,
	streamPublisher: StreamPublisher,
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

	let data = logStore.requestFrom(
		streamId,
		partition,
		fromTimestamp,
		fromSequenceNumber,
		publisherId
	);

	const requestId = uuid();
	const queryMessage = new QueryRequest({
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
			publisherId,
		},
	});

	const consensus = await getConsensus(
		queryMessage,
		nodeManager,
		logStoreClient,
		systemStream,
		streamPublisher
	);

	data = logStore.requestFrom(
		streamId,
		partition,
		fromTimestamp,
		fromSequenceNumber,
		publisherId
	);
	sendSuccess(data, consensus, format, version, streamId, res);
};

const handleRange = async (
	req: RangeRequest,
	streamId: string,
	partition: number,
	format: Format,
	version: number | undefined,
	res: Response,
	nodeManager: LogStoreNodeManager,
	logStore: LogStore,
	logStoreClient: LogStoreClient,
	systemStream: Stream,
	streamPublisher: StreamPublisher,
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

	let data = logStore.requestRange(
		streamId,
		partition,
		fromTimestamp,
		fromSequenceNumber,
		toTimestamp,
		toSequenceNumber,
		publisherId,
		msgChainId
	);

	const requestId = uuid();
	const queryMessage = new QueryRequest({
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
			publisherId,
			msgChainId,
		},
	});

	const consensus = await getConsensus(
		queryMessage,
		nodeManager,
		logStoreClient,
		systemStream,
		streamPublisher
	);

	data = logStore.requestRange(
		streamId,
		partition,
		fromTimestamp,
		fromSequenceNumber,
		toTimestamp,
		toSequenceNumber,
		publisherId,
		msgChainId
	);
	sendSuccess(data, consensus, format, version, streamId, res);
};

const createHandler = (
	config: Pick<StrictConfig, 'client'>,
	logStore: LogStore,
	logStoreClient: LogStoreClient,
	systemStream: Stream,
	streamPublisher: StreamPublisher,
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
		// TODO: Default the format to 'text/event-stream' by default for simplicity.
		const format = getFormat(req.query.format as string);
		if (format === undefined) {
			sendError(
				`Query parameter "format" is invalid: ${req.query.format}`,
				res
			);
			return;
		}

		const consumer = toEthereumAddress(req.consumer!);
		const provider = new ethers.providers.JsonRpcProvider(
			config.client!.contracts?.streamRegistryChainRPCs!.rpcs[0]
		);
		const nodeManager = await getNodeManagerContract(provider);
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
			switch (req.params.queryType) {
				case 'last':
					await handleLast(
						req,
						streamId,
						partition,
						format,
						version,
						res,
						nodeManager,
						logStore,
						logStoreClient,
						systemStream,
						streamPublisher,
						metrics
					);
					break;
				case 'from':
					await handleFrom(
						req,
						streamId,
						partition,
						format,
						version,
						res,
						nodeManager,
						logStore,
						logStoreClient,
						systemStream,
						streamPublisher,
						metrics
					);
					break;
				case 'range':
					await handleRange(
						req,
						streamId,
						partition,
						format,
						version,
						res,
						nodeManager,
						logStore,
						logStoreClient,
						systemStream,
						streamPublisher,
						metrics
					);
					break;
				default:
					sendError('Unknown query type', res);
					break;
			}
		} catch (error) {
			sendError(error, res);
		}
	};
};

export const createDataQueryEndpoint = (
	config: Pick<StrictConfig, 'client'>,
	logStore: LogStore,
	logStoreClient: LogStoreClient,
	systemStream: Stream,
	streamPublisher: StreamPublisher,
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
			createHandler(
				config,
				logStore,
				logStoreClient,
				systemStream,
				streamPublisher,
				metrics
			),
		],
	};
};
