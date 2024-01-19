import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { EthereumAddress, StreamPermission, formStorageNodeAssignmentStreamId } from "streamr-client";
import { nodeArgument } from '../arguments';
import { getStreamrClient } from '../utils/getStreamrClient';

const logger = new Logger(module);

interface Options {
  devNetwork: boolean;
  privateKey: string;
}

export const joinCommand = new Command("join")
  .description('Join a Node to a StorageProxy')
  .addArgument(nodeArgument)
  .action(async (node: EthereumAddress) => {
    try {
      const options = program.optsWithGlobals() as Options;

      const streamrClient = getStreamrClient(options);
      const clusterId = await streamrClient.getAddress();

      logger.info(`Joining the StorageProxy Node ${node} to the StorageProxy ${clusterId}...`);

      const assignmentsStreamId = formStorageNodeAssignmentStreamId(clusterId);

      logger.info(`Setting permissions to the assignments stream...`);
      await streamrClient.grantPermissions(assignmentsStreamId, {
        user: node,
        permissions: [StreamPermission.PUBLISH],
      });

      logger.info(`Done.`);
    } catch (err) {
      logger.error('Join a Node to a StorageProxy failed', { err });
    }
  });
