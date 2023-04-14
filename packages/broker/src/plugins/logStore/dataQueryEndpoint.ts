/**
 * Endpoints for RESTful data requests
 */
import { StreamMessage } from '@streamr/protocol';
import {
	Logger,
	MetricsContext,
	MetricsDefinition,
	RateMetric,
} from '@streamr/utils';
import { Request, RequestHandler, Response } from 'express';
import { pipeline, Readable, Transform } from 'stream';

import { HttpServerEndpoint } from '../../Plugin';
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
	format: Format,
	version: number | undefined,
	streamId: string,
	res: Response
) => {
	data.once('data', () => {
		res.writeHead(200, {
			'Content-Type': format.contentType,
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

const handleLast = (
	req: LastRequest,
	streamId: string,
	partition: number,
	format: Format,
	version: number | undefined,
	res: Response,
	logStore: LogStore,
	metrics: MetricsDefinition
) => {
	metrics.resendLastQueriesPerSecond.record(1);
	const count =
		req.query.count === undefined ? 1 : parseIntIfExists(req.query.count);
	if (Number.isNaN(count)) {
		sendError(`Query parameter "count" not a number: ${req.query.count}`, res);
		return;
	}
	let data = logStore.requestLast(streamId, partition, count!);
	data = getConsensus(streamId, data);
	sendSuccess(data, format, version, streamId, res);
};

const handleFrom = (
	req: FromRequest,
	streamId: string,
	partition: number,
	format: Format,
	version: number | undefined,
	res: Response,
	logStore: LogStore,
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
	data = getConsensus(streamId, data);
	sendSuccess(data, format, version, streamId, res);
};

const handleRange = (
	req: RangeRequest,
	streamId: string,
	partition: number,
	format: Format,
	version: number | undefined,
	res: Response,
	logStore: LogStore,
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
	// TODO: Include a function here to produce the query system stream params, and send the system stream message.
	data = getConsensus(streamId, data);
	sendSuccess(data, format, version, streamId, res);
};

const createHandler = (
	logStore: LogStore,
	metrics: MetricsDefinition
): RequestHandler => {
	return (req: Request, res: Response) => {
		// TODO: Consumers will not need to query a partition -- therefore this can be removed.
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
		const streamId = req.params.id;
		const partition = parseInt(req.params.partition);
		const version = parseIntIfExists(req.query.version as string);
		switch (req.params.resendType) {
			case 'last':
				handleLast(
					req,
					streamId,
					partition,
					format,
					version,
					res,
					logStore,
					metrics
				);
				break;
			case 'from':
				handleFrom(
					req,
					streamId,
					partition,
					format,
					version,
					res,
					logStore,
					metrics
				);
				break;
			case 'range':
				handleRange(
					req,
					streamId,
					partition,
					format,
					version,
					res,
					logStore,
					metrics
				);
				break;
			default:
				sendError('Unknown resend type', res);
				break;
		}
	};
};

export const createDataQueryEndpoint = (
	logStore: LogStore,
	metricsContext: MetricsContext
): HttpServerEndpoint => {
	const metrics = {
		resendLastQueriesPerSecond: new RateMetric(),
		resendFromQueriesPerSecond: new RateMetric(),
		resendRangeQueriesPerSecond: new RateMetric(),
	};
	metricsContext.addMetrics('broker.plugin.logstore', metrics);
	return {
		path: `/streams/:id/data/partitions/:partition/:resendType`,
		method: 'get',
		requestHandlers: [createHandler(logStore, metrics)],
	};
};

export const getConsensus = (streamId: string, data: Readable) => {
	// 1. Iterate over all the items in data readable
	// 2. hash each of them, prepending the previous hash -- ie.
	// hash = keccak256(fromStringToUint8Array(toString(hash) + data[i].message))
	// size = size + Buffer.byteLength(data[i].message);
	// 3. Ship the message over the system stream
	// 4. Await messages to be received via the system stream listner
	// 5. Compare local metadata to received metadata
	// 6. Collate all system publisher ids, signatures and hashhes and include them as items in the readable stream.... -- if this is possible...
	// Send the response
	return data;
};
