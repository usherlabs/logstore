import { getClientsFromOptions } from '@/utils/logstore-client';
import { logger } from '@/utils/utils';
import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import { EthereumAddress, StreamPermission, formStorageNodeAssignmentStreamId } from "streamr-client";
import { nodeOption } from './options';

interface Options {
  node: EthereumAddress;
}

export const storageProxyJoin = new Command("join")
  .description('Join a Node to a StorageProxy')
  .addOption(nodeOption)
  .action(async (options: Options) => {
    try {
      const { streamrClient } = getClientsFromOptions();
      const clusterId = await streamrClient.getAddress();

      logger.info(`Joining the StorageProxy Node ${chalk.green(options.node)} to the StorageProxy ${chalk.green(clusterId)}...`);

      const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

      logger.info(`Setting permissions to the assignments stream...`);
      await streamrClient.grantPermissions(assignmentsStreamId, {
        user: options.node,
        permissions: [StreamPermission.PUBLISH],
      });

      logger.info(`Done.`);
    } catch (e) {
      logger.info(chalk.red('Join a Node to a StorageProxy failed'));
      logger.error(e);
    }
  });
