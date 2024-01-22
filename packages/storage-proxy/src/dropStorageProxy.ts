import { Logger } from "@streamr/utils";
import { formStorageNodeAssignmentStreamId } from "streamr-client";
import { getStreamrClient } from "./utils/getStreamrClient";

const logger = new Logger(module);

interface Options {
  privateKey: string;
  devNetwork?: boolean;
}

export const dropStorageProxy = async (options: Options) => {
  const streamrClient = getStreamrClient(options);
  const clusterId = await streamrClient.getAddress();

  logger.info(`Dropping a StorageProxy with address ${clusterId}...`);

  logger.info(`Clearing metadata of the StorageProxy...`);
  await streamrClient.setStorageNodeMetadata(undefined);

  const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

  logger.info(`Deleting assignments stream...`);
  await streamrClient.deleteStream(assignmentsStreamId);

  logger.info(`Dropped a StorageProxy with address ${clusterId}...`);
};
