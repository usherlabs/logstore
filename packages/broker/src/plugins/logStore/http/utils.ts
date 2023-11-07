import { Request } from 'express';

export const isStreamRequest = (req: Request): boolean => {
	return req.headers.accept === 'text/event-stream';
};

export const hasToVerifyNetworkResponses = (req: Request): boolean => {
	const verifyNetworkResponses = req.query.verifyNetworkResponses;
	return isTruthy(verifyNetworkResponses);
};

function isTruthy(value: unknown): boolean {
	if (typeof value === 'string') {
		return value.toLowerCase() === 'true';
	}
	return Boolean(value);
}
