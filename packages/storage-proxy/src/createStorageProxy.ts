import { Logger } from '@streamr/utils';
import {
	formStorageNodeAssignmentStreamId,
	StorageNodeMetadata,
	StreamPermission,
} from 'streamr-client';

import { getStreamrClient } from './utils/getStreamrClient';

const logger = new Logger(module);

interface Options {
	privateKey: string;
	metadata: StorageNodeMetadata;
	devNetwork?: boolean;
}

export const createStorageProxy = async (options: Options) => {
	const streamrClient = getStreamrClient(options);
	const clusterId = await streamrClient.getAddress();

	logger.info(`Creating a StorageProxy with address ${clusterId}...`);

	const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

	logger.info(`Creating assignments stream...`);
	await streamrClient.createStream(assignmentsStreamId);

	logger.info(`Setting permissions to the assignments stream...`);
	await streamrClient.grantPermissions(assignmentsStreamId, {
		public: true,
		permissions: [StreamPermission.SUBSCRIBE],
	});

	logger.info(`Setting metadata to the StorageProxy...`);
	await streamrClient.setStorageNodeMetadata(options.metadata);

	logger.info(`Created a StorageProxy with address ${clusterId}...`);
};
