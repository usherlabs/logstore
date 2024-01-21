import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { EthereumAddress } from "streamr-client";
import { leaveStorageProxy } from '../../leaveStorageProxy';
import { nodeArgument } from '../arguments';

const logger = new Logger(module);

interface Options {
  privateKey: string;
  devNetwork: boolean;
}

export const leaveCommand = new Command("leave")
  .description('Leave a StorageProxy')
  .addArgument(nodeArgument)
  .action(async (node: EthereumAddress) => {
    try {
      const options = program.optsWithGlobals() as Options;

      await leaveStorageProxy({
        ...options,
        node
      });

    } catch (err) {
      logger.error('Leave a StorageProxy failed', { err });
    }
  });
