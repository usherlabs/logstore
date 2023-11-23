import { BrokerProgram, BrokerProgramModule } from '@logsn/broker-program';
import { LogStoreClient, Stream } from '@logsn/client';
import { StreamMessage } from '@streamr/protocol';
import { Logger } from '@streamr/utils';

import { LogStorePluginConfig } from './LogStorePlugin';

const logger = new Logger(module);

const PROGRAM_PATHS: { [key: string]: string } = {
	'evm-validate': 'evm-validate.js',
	'solana-validate': 'solana-validate.js',
};

export class MessageProcessor {
	private programs: { [key: string]: BrokerProgram } = {};

	constructor(
		private readonly config: Pick<LogStorePluginConfig, 'programs'>,
		private readonly logStoreClient: LogStoreClient,
		private readonly topicsStream: Stream
	) {
		//
	}

	public async process(msg: StreamMessage) {
		const content = msg.getParsedContent();
		const { logStoreChainId, logStoreChannelId } = content as {
			logStoreChainId: string;
			logStoreChannelId: string;
		};

		if (!logStoreChannelId) {
			return;
		}

		const program = await this.getProgram(logStoreChainId, logStoreChannelId);
		if (!program) {
			return;
		}

		try {
			const processedContent = await program.process(content);

			await this.logStoreClient.publish(this.topicsStream, {
				logStoreStreamId: msg.getStreamId(),
				...(processedContent as object),
			});
		} catch (error) {
			logger.error('Failed to process Event by BrokerProgram', {
				logStoreChannelId,
				error,
			});
		}
	}

	private async getProgram(
		chainId: string,
		channelId: string
	): Promise<BrokerProgram | undefined> {
		let program = this.programs[`${chainId}/${channelId}`];

		if (!program) {
			const programPath = PROGRAM_PATHS[channelId];
			if (!programPath) {
				logger.warn('Program is not defined for channel', {
					channelId: channelId,
				});
				return undefined;
			}

			const rpcUrl = this.config.programs.chainRpcUrls[chainId];
			if (!rpcUrl) {
				logger.warn('RPC URL is not defined for ChainId', {
					chainId: chainId,
				});
				return undefined;
			}

			try {
				const path = `${__dirname}/programs/${programPath}`;
				const programModule = (await import(path)) as BrokerProgramModule;

				program = programModule.createProgram(rpcUrl);
				this.programs[`${chainId}/${channelId}`] = program;
			} catch (error) {
				logger.error('Failed to create BrokerProgram for channel', {
					logStoreChannelId: channelId,
					error,
				});
			}
		}

		return program;
	}
}
