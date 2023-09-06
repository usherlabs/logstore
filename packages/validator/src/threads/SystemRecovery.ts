import {
	EthereumAddress,
	LogStoreClient,
	MessageMetadata,
	NodeMetadata,
	Stream,
	Subscription,
} from '@logsn/client';
import {
	RecoveryComplete,
	RecoveryResponse,
	SystemMessage,
	SystemMessageType,
} from '@logsn/protocol';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { Signer } from 'ethers';
import { Base64 } from 'js-base64';
import { shuffle } from 'lodash';
import { Logger } from 'tslog';

import { Managers } from '../managers';
import { MessageMetricsSummary } from '../shared/MessageMetricsSummary';
import { ActivityTimeout } from './ActivityTimeout';

const RESTART_DELAY = 30 * 1000;
const ACTIVITY_TIMEOUT = 30 * 1000;

const LISTENING_MESSAGE_TYPES = [
	SystemMessageType.RecoveryResponse,
	SystemMessageType.RecoveryComplete,
];

interface RecoveryProgress {
	timestamp?: number;
	lastSeqNum: number;
	isComplete: boolean;
	isFulfilled: boolean;
}

interface RecoverySummary {
	timestamp?: number;
	isComplete: boolean;
	isFulfilled: boolean;
}

export class SystemRecovery {
	private requestId: string;
	private toTimestamp: number;
	private subscription?: Subscription;
	private onSystemMessage?: (
		systemMessage: SystemMessage,
		metadata: MessageMetadata
	) => Promise<void>;

	private progresses: Map<EthereumAddress, RecoveryProgress> = new Map();
	private isRestarting: boolean = false;

	private activityTimeout: ActivityTimeout;
	private restartTimeout?: NodeJS.Timeout;

	constructor(
		private readonly client: LogStoreClient,
		private readonly recoveryStream: Stream,
		private readonly signer: Signer,
		private readonly messageMetricsSummary: MessageMetricsSummary,
		private readonly logger: Logger
	) {
		this.toTimestamp = Date.now();
		this.activityTimeout = new ActivityTimeout(
			this.onActivityTimeout.bind(this),
			ACTIVITY_TIMEOUT
		);
	}

	public async start(
		onSystemMessage: (
			systemMessage: SystemMessage,
			metadata: MessageMetadata
		) => Promise<void>
	) {
		this.logger.info('Starting SystemRecovery ...');

		this.onSystemMessage = onSystemMessage;
		this.subscription = await this.client.subscribe(
			this.recoveryStream,
			this.onRecoveryMessage.bind(this)
		);

		await this.callRecoveryEndpoint();
	}

	public async stop() {
		this.activityTimeout.stop();
		clearTimeout(this.restartTimeout);

		await this.subscription?.unsubscribe();
		this.subscription = undefined;

		this.logger.info('Stopped');
	}

	public get progress(): RecoverySummary {
		if (this.progresses.size === 0) {
			return { isComplete: false, isFulfilled: false };
		}

		const summary: RecoverySummary = {
			timestamp: Number.MAX_SAFE_INTEGER,
			isComplete: true,
			isFulfilled: true,
		};

		for (const [_, progress] of this.progresses) {
			if (progress.timestamp === undefined) {
				return { isComplete: false, isFulfilled: false };
			}

			summary.timestamp = Math.min(summary.timestamp || 0, progress.timestamp);
			summary.isComplete = summary.isComplete && progress.isComplete;
			summary.isFulfilled = summary.isFulfilled && progress.isFulfilled;
		}

		return summary;
	}

	private async onActivityTimeout() {
		this.logger.warn('Activity timeout');
		await this.callRecoveryEndpoint();
	}

	private waitAndRestart() {
		this.restartTimeout = setTimeout(async () => {
			await this.callRecoveryEndpoint();
		}, RESTART_DELAY);
	}

	private async callRecoveryEndpoint() {
		const endpoint = `${await this.getBrokerEndpoint()}/recovery`;
		const authUser = await this.client.getAddress();
		const authPassword = await this.signer.signMessage(authUser);

		this.requestId = randomUUID();
		const from = this.progress.timestamp || 0;
		const to = this.toTimestamp;

		const headers = {
			'Content-Type': 'application/json',
			Authorization: `Basic ${Base64.encode(`${authUser}:${authPassword}`)}`,
		};

		this.logger.debug(
			'Calling recovery enpoint',
			JSON.stringify({
				endpoint,
				requestId: this.requestId,
				from,
				to,
			})
		);

		const response = await axios.post(
			endpoint,
			{
				requestId: this.requestId,
				from,
				to,
			},
			{ headers }
		);

		const brokerAddresses = response.data as EthereumAddress[];

		for (const brokerAddress of brokerAddresses) {
			const progress = {
				...(this.progresses.get(brokerAddress) || {
					isComplete: false,
					lastSeqNum: -1,
				}),
				isComplete: false,
				isFulfilled: false,
				lastSeqNum: -1,
			};

			this.progresses.set(brokerAddress, progress);
		}

		this.logger.debug(
			'Collecting RecoveryResponses from brokers',
			JSON.stringify(brokerAddresses)
		);
	}

	private async getBrokerEndpoint() {
		const addresses = shuffle(
			await Managers.withSources(async (managers) => {
				return await managers.node.contract.nodeAddresses();
			})
		);

		for (const address of addresses) {
			const node = await Managers.withSources(async (managers) => {
				return await managers.node.contract.nodes(address);
			});

			if (node.metadata.includes('http')) {
				try {
					const metadata = JSON.parse(node.metadata) as NodeMetadata;
					new URL(metadata.http);
					return metadata.http;
				} catch {
					// do nothing
				}
			}
		}

		throw new Error('No available enpoints');
	}

	private async onRecoveryMessage(
		content: unknown,
		metadata: MessageMetadata
	): Promise<void> {
		this.messageMetricsSummary.update(content, metadata);
		const systemMessage = SystemMessage.deserialize(content);
		if (!LISTENING_MESSAGE_TYPES.includes(systemMessage.messageType)) {
			return;
		}

		const recoveryMessage = systemMessage as
			| RecoveryResponse
			| RecoveryComplete;
		if (recoveryMessage.requestId != this.requestId) {
			return;
		}

		let progress = this.progresses.get(metadata.publisherId);
		if (!progress) {
			progress = { isComplete: false, isFulfilled: false, lastSeqNum: -1 };
			this.progresses.set(metadata.publisherId, progress);
		}

		try {
			switch (systemMessage.messageType) {
				case SystemMessageType.RecoveryResponse: {
					const recoveryResponse = systemMessage as RecoveryResponse;
					await this.processRecoveryResponse(
						recoveryResponse,
						metadata,
						progress
					);
					break;
				}
				case SystemMessageType.RecoveryComplete: {
					const recoveryComplete = systemMessage as RecoveryComplete;
					await this.processRecoveryComplete(
						recoveryComplete,
						metadata,
						progress
					);
					break;
				}
			}

			this.activityTimeout.update();
		} catch (error: any) {
			if (!this.isRestarting) {
				this.isRestarting = true;
				this.logger.warn('Failed to process RecoveryMessage', {
					message: error.message,
				});

				this.activityTimeout.stop();
				this.waitAndRestart();
			}
		}
	}

	private async processRecoveryResponse(
		recoveryResponse: RecoveryResponse,
		metadata: MessageMetadata,
		progress: RecoveryProgress
	) {
		this.logger.debug(
			`Processing RecoveryResponse ${JSON.stringify({
				publisherId: metadata.publisherId,
				seqNum: recoveryResponse.seqNum,
				payloadLength: recoveryResponse.payload.length,
			})}`
		);

		if (recoveryResponse.seqNum - progress.lastSeqNum !== 1) {
			throw new Error(
				`RecoveryResponse has unexpected seqNum ${JSON.stringify({
					seqNum: recoveryResponse.seqNum,
				})}`
			);
		}

		for await (const [msg, msgMetadata] of recoveryResponse.payload) {
			await this.onSystemMessage?.(msg, msgMetadata as MessageMetadata);
			progress.timestamp = msgMetadata.timestamp;
		}

		progress.lastSeqNum = recoveryResponse.seqNum;
	}

	private async processRecoveryComplete(
		recoveryComplete: RecoveryComplete,
		metadata: MessageMetadata,
		progress: RecoveryProgress
	) {
		this.logger.debug(
			`Processing RecoveryComplete ${JSON.stringify({
				publisherId: metadata.publisherId,
				seqNum: recoveryComplete.seqNum,
			})}`
		);

		if (recoveryComplete.seqNum - progress.lastSeqNum !== 1) {
			throw new Error(
				`RecoveryComplete has unexpected seqNum ${JSON.stringify({
					seqNum: recoveryComplete.seqNum,
				})}`
			);
		}

		// if no recovery messages received
		if (progress.timestamp === undefined) {
			progress.timestamp = 0;
		}

		progress.isComplete = true;
		progress.isFulfilled = recoveryComplete.isFulfilled;

		if (this.progress.isComplete) {
			if (this.progress.isFulfilled) {
				this.logger.info('Successfully complete Recovery');
				setImmediate(this.stop.bind(this));
			} else {
				this.logger.info(
					'Successfully complete Recovery Round. Sending next Request.'
				);
				this.activityTimeout.stop();
				setImmediate(this.callRecoveryEndpoint.bind(this));
			}
		}
	}
}
