import { toStreamID, toStreamPartID } from '@streamr/protocol';
import express, { Request, Response, Router } from 'express';
import { LogStoreConfig } from './LogStoreConfig';

const createHandler = (logStoreConfig: LogStoreConfig) => {
	return (req: Request, res: Response) => {
		const { id, partition } = req.params;
		const isValidPartition = !Number.isNaN(parseInt(partition));
		if (isValidPartition) {
			const found = logStoreConfig.hasStreamPart(
				toStreamPartID(toStreamID(id), Number(partition))
			);
			if (found) {
				res.status(200).send({});
			} else {
				res.status(404).end();
			}
		} else {
			res.status(400).send('Partition is not a number: ' + partition);
		}
	};
};

export const router = (logStoreConfig: LogStoreConfig): Router => {
	const router = express.Router();
	const handler = createHandler(logStoreConfig);
	router.get('/streams/:id/storage/partitions/:partition', handler);
	return router;
};
