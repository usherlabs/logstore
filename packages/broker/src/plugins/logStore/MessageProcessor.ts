import { BrokerProgram, BrokerProgramModule } from '@logsn/broker-program';
import { StreamMessage } from '@streamr/protocol';
import { Logger } from '@streamr/utils';
import StreamrClient, { Stream } from 'streamr-client';

import { LogStorePluginConfig } from './LogStorePlugin';

const logger = new Logger(module);

const PROGRAM_PATHS: { [key: string]: string } = {
	'evm-validate': 'evm-validate.js',
	'solana-validate': 'solana-validate.js',
};

interface EventMessage {
	__logStoreChainId?: string;
	__logStoreChannelId?: string;
}

export class MessageProcessor {
	private programs: { [key: string]: BrokerProgram } = {};

	constructor(
		private readonly config: Pick<LogStorePluginConfig, 'programs'>,
		private readonly streamrClient: StreamrClient,
		private readonly topicsStream: Stream
	) {
		//
	}

	public async process(msg: StreamMessage) {
		const content = msg.getParsedContent() as EventMessage;

		const { __logStoreChainId, __logStoreChannelId } = content;

		if (!__logStoreChainId || !__logStoreChannelId) {
			return;
		}

		const program = await this.getProgram(
			__logStoreChainId,
			__logStoreChannelId
		);
		if (!program) {
			return;
		}

		try {
			delete content.__logStoreChainId;
			delete content.__logStoreChannelId;

			const processedContent = await program.process(content);

			await this.streamrClient.publish(this.topicsStream, {
				logStoreChainId: __logStoreChainId,
				logStoreChannelId: __logStoreChannelId,
				logStoreStreamId: msg.getStreamId(),
				...(processedContent as object),
			});
		} catch (error) {
			logger.error('Failed to process Event by BrokerProgram', {
				logStoreChainId: __logStoreChainId,
				logStoreChannelId: __logStoreChannelId,
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
