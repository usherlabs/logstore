import { Request } from 'express';

export const isStreamRequest = (req: Request): boolean => {
	return req.headers.accept === 'text/event-stream';
};
