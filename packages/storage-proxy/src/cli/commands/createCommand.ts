import { Logger } from '@streamr/utils';
import { Command, program } from 'commander';
import { StorageNodeMetadata } from "streamr-client";
import { createStorageProxy } from '../../createStorageProxy';
import { metadataArgument } from '../arguments';

const logger = new Logger(module);

interface Options {
  privateKey: string;
  devNetwork: boolean;
}

export const createCommand = new Command("create")
  .description('Create a StorageProxy')
  .addArgument(metadataArgument)
  .action(async (metadata: StorageNodeMetadata) => {
    try {
      const options = program.optsWithGlobals() as Options;

      await createStorageProxy({
        ...options,
        metadata
      });

    } catch (err) {
      logger.error('Create a StorageProxy failed', { err });
    }
  });
