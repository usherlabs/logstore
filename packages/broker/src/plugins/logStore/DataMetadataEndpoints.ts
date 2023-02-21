import express, { Request, Response, Router } from 'express';

import { LogStore } from './LogStore';

const parseIntIfExists = (x: string | undefined): number | undefined => {
	return x === undefined ? undefined : parseInt(x);
};

export const router = (logStore: LogStore): Router => {
	const router = express.Router();
	const handler = async (req: Request, res: Response) => {
		const streamId = req.params.id;
		const partition = parseIntIfExists(req.params.partition);
		if (Number.isNaN(partition) || partition === undefined) {
			const errMsg = `Path parameter "partition" not a number: ${req.params.partition}`;
			res.status(400).send({
				error: errMsg,
			});
			return;
		}

		const out = {
			totalBytes: await logStore.getTotalBytesInStream(streamId, partition),
			totalMessages: await logStore.getNumberOfMessagesInStream(
				streamId,
				partition
			),
			firstMessage: await logStore.getFirstMessageTimestampInStream(
				streamId,
				partition
			),
			lastMessage: await logStore.getLastMessageTimestampInStream(
				streamId,
				partition
			),
		};

		res.status(200).send(out);
	};

	router.get('/streams/:id/metadata/partitions/:partition', handler);

	return router;
};
