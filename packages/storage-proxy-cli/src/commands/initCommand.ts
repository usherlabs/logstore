import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { StorageNodeMetadata, StreamPermission, formStorageNodeAssignmentStreamId } from "streamr-client";
import { metadataArgument } from '../arguments';
import { getStreamrClient } from '../utils/getStreamrClient';

const logger = new Logger(module);

interface Options {
  devNetwork: boolean;
  privateKey: string;
}

export const initCommand = new Command("init")
  .description('Initialize a StorageProxy')
  .addArgument(metadataArgument)
  .action(async (metadata: StorageNodeMetadata) => {
    try {
      const options = program.optsWithGlobals() as Options;

      const streamrClient = getStreamrClient(options);
      const clusterId = await streamrClient.getAddress();

      logger.info(`Initializing a StorageProxy with address ${clusterId}...`);

      const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

      logger.info(`Creating assignments stream...`);
      await streamrClient.createStream(assignmentsStreamId);

      logger.info(`Setting permissions to the assignments stream...`);
      await streamrClient.grantPermissions(assignmentsStreamId, {
        public: true,
        permissions: [StreamPermission.SUBSCRIBE],
      });

      logger.info(`Setting metadata to the StorageProxy...`);
      await streamrClient.setStorageNodeMetadata(metadata);

      logger.info(`Done.`);
    } catch (err) {
      logger.error('Initialize a StorageProxy failed', { err });
    }
  });
