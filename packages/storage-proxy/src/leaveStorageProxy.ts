import { EthereumAddress, Logger } from "@streamr/utils";
import { StreamPermission, formStorageNodeAssignmentStreamId } from "streamr-client";
import { getStreamrClient } from "./utils/getStreamrClient";

const logger = new Logger(module);

interface Options {
  node: EthereumAddress,
  privateKey: string;
  devNetwork?: boolean;
}

export const leaveStorageProxy = async (options: Options) => {
  const streamrClient = getStreamrClient(options);
  const clusterId = await streamrClient.getAddress();

  logger.info(`The StorageProxy Node ${options.node} is leaving the StorageProxy ${clusterId}...`);

  const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

  logger.info(`Revoking permissions to the assignments stream...`);
  await streamrClient.revokePermissions(assignmentsStreamId, {
    user: options.node,
    permissions: [StreamPermission.PUBLISH],
  });

  logger.info(`The StorageProxy Node ${options.node} left the StorageProxy ${clusterId}...`);
};
