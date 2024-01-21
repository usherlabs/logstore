import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { EthereumAddress } from "streamr-client";
import { joinStorageProxy } from '../../joinStorageProxy';
import { nodeArgument } from '../arguments';

const logger = new Logger(module);

interface Options {
  privateKey: string;
  devNetwork: boolean;
}

export const joinCommand = new Command("join")
  .description('Join a Node to a StorageProxy')
  .addArgument(nodeArgument)
  .action(async (node: EthereumAddress) => {
    try {
      const options = program.optsWithGlobals() as Options;

      await joinStorageProxy({
        ...options,
        node
      });

    } catch (err) {
      logger.error('Join a Node to a StorageProxy failed', { err });
    }
  });
