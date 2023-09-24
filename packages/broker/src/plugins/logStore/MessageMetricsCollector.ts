import {
	LogStoreClient,
	MessageMetadata,
	Stream,
	Subscription,
} from '@logsn/client';
import { SystemMessageType } from '@logsn/protocol';

import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import {
	MessageMetricsSubject,
	MessageMetricsSummary,
} from '../../shared/MessageMetricsSummary';

const METRICS_SUBJECTS: MessageMetricsSubject[] = [
	{
		subject: 'ProofOfMessageStored',
		type: SystemMessageType.ProofOfMessageStored,
	},
	{
		subject: 'ProofOfReport',
		type: SystemMessageType.ProofOfReport,
	},
	{
		subject: 'RollCallRequest',
		type: SystemMessageType.RollCallRequest,
	},
	{
		subject: 'RollCallResponse',
		type: SystemMessageType.RollCallResponse,
	},
	{
		subject: 'QueryRequest',
		type: SystemMessageType.QueryRequest,
	},
	{
		subject: 'QueryResponse',
		type: SystemMessageType.QueryResponse,
	},
	{
		subject: 'RecoveryRequest',
		type: SystemMessageType.RecoveryRequest,
	},
];

export class MessageMetricsCollector {
	private readonly messageMetricsSummary: MessageMetricsSummary;

	private recoverySubscription?: Subscription;

	constructor(
		private readonly client: LogStoreClient,
		private readonly systemSubscriber: BroadbandSubscriber,
		private readonly rollCallSubscriber: BroadbandSubscriber,
		private readonly recoveryStream: Stream
	) {
		this.messageMetricsSummary = new MessageMetricsSummary(METRICS_SUBJECTS);
	}

	public async start() {
		await this.systemSubscriber.subscribe(this.onSystemMessage.bind(this));
		await this.rollCallSubscriber.subscribe(this.onRollCallMessage.bind(this));

		this.recoverySubscription = await this.client.subscribe(
			this.recoveryStream,
			this.onRecoveryMessage.bind(this)
		);
	}

	public get summary() {
		return this.messageMetricsSummary.summary;
	}

	public async stop() {
		await this.recoverySubscription?.unsubscribe();

		await this.rollCallSubscriber.unsubscribe();
		await this.systemSubscriber.unsubscribe();
	}

	private async onSystemMessage(message: unknown, metadata: MessageMetadata) {
		this.messageMetricsSummary.update(message, metadata);
	}

	private async onRollCallMessage(message: unknown, metadata: MessageMetadata) {
		this.messageMetricsSummary.update(message, metadata);
	}

	private async onRecoveryMessage(message: unknown, metadata: MessageMetadata) {
		this.messageMetricsSummary.update(message, metadata);
	}
}