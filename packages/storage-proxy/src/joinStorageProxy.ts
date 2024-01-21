import { EthereumAddress, Logger } from "@streamr/utils";
import { StreamPermission, formStorageNodeAssignmentStreamId } from "streamr-client";
import { getStreamrClient } from "./utils/getStreamrClient";

const logger = new Logger(module);

interface Options {
  node: EthereumAddress,
  privateKey: string;
  devNetwork?: boolean;
}

export const joinStorageProxy = async (options: Options) => {
  const streamrClient = getStreamrClient(options);
  const clusterId = await streamrClient.getAddress();

  logger.info(`Joining the StorageProxy Node ${options.node} to the StorageProxy ${clusterId}...`);

  const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

  logger.info(`Setting permissions to the assignments stream...`);
  await streamrClient.grantPermissions(assignmentsStreamId, {
    user: options.node,
    permissions: [StreamPermission.PUBLISH],
  });

  logger.info(`Joined the StorageProxy Node ${options.node} to the StorageProxy ${clusterId}...`);
};
