import { getClientsFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import { StorageNodeMetadata, StreamPermission, formStorageNodeAssignmentStreamId } from "streamr-client";
import { metadataOption } from './options';

interface Options {
  metadata: StorageNodeMetadata;
}

export const storageProxyInit = new Command("init")
  .description('Initialize a StorageProxy')
  .addOption(metadataOption)
  .action(async (options: Options) => {
    try {
      const { streamrClient } = getClientsFromOptions();
      const clusterId = await streamrClient.getAddress();

      logger.info(`Initializing a StorageProxy with address ${chalk.green(clusterId)}...`);

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

      logger.info(`Done.`);
    } catch (e) {
      logger.info(chalk.red('Initialize a StorageProxy failed'));
      logger.error(e);
    }
  });
