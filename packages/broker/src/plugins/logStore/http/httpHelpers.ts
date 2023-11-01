import { Logger } from '@streamr/utils';
import { Request, Response } from 'express';
import { pipeline, Readable } from 'stream';

import { Format } from './DataQueryFormat';
import {
	MessageLimitTransform,
	ResponseTransform,
	StreamResponseTransform,
} from './dataTransformers';
import { getMessageLimitForRequest } from './messageLimiter';
import { hasToVerifyNetworkResponses, isStreamRequest } from './utils';

const logger = new Logger(module);

export const sendSuccess = (
	data: Readable,
	format: Format,
	version: number | undefined,
	streamId: string,
	requestId: string,
	participatingBrokers: string[],
	req: Request,
	res: Response
) => {
	data.once('readable', () => {
		res.writeHead(200, {
			'Content-Type': isStreamRequest(req)
				? 'text/event-stream'
				: format.contentType,
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

	if (hasToVerifyNetworkResponses(req)) {
		responseTransform.updateMetadata((metadata) => ({
			...metadata,
			participatingNodesAddress: participatingBrokers,
			requestId: requestId,
		}));
	}

	const messageLimitForRequest = getMessageLimitForRequest(req);

	const messageLimitTransform = new MessageLimitTransform(
		messageLimitForRequest
	);

	messageLimitTransform.onMessageLimitReached(({ nextMessage }) => {
		if (responseTransform instanceof ResponseTransform) {
			responseTransform.updateMetadata((metadata) => ({
				...metadata,
				hasNext: true,
				nextTimestamp: nextMessage.getTimestamp(),
				nextSequenceNumber: nextMessage.getSequenceNumber(),
			}));
		}
	});

	pipeline(data, messageLimitTransform, responseTransform, res, (err) => {
		if (err !== undefined && err !== null) {
			logger.error(`Pipeline error in DataQueryEndpoints: ${streamId}`, err);
		}
	});
};

export const sendError = (message: string, res: Response) => {
	logger.error(message);
	res.status(400).json({
		error: message,
	});
};
