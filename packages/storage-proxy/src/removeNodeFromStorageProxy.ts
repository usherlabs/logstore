import { EthereumAddress, Logger } from '@streamr/utils';
import {
	formStorageNodeAssignmentStreamId,
	StreamPermission,
} from 'streamr-client';

import { getStreamrClient } from './utils/getStreamrClient';

const logger = new Logger(module);

interface Options {
	node: EthereumAddress;
	privateKey: string;
	devNetwork?: boolean;
}

export const removeNodeFromStorageProxy = async (options: Options) => {
	const streamrClient = getStreamrClient(options);
	const clusterId = await streamrClient.getAddress();

	logger.info(
		`Removing the StorageProxy Node ${options.node} from the StorageProxy ${clusterId}...`
	);

	const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

	logger.info(`Revoking permissions to the assignments stream...`);
	await streamrClient.revokePermissions(assignmentsStreamId, {
		user: options.node,
		permissions: [StreamPermission.PUBLISH],
	});

	logger.info(
		`Removed the StorageProxy Node ${options.node} from the StorageProxy ${clusterId}...`
	);
};
