import { MessageMetadata } from '@logsn/client';
import { SystemMessageType } from '@logsn/protocol';

import { BroadbandSubscriber } from '../../shared/BroadbandSubscriber';
import {
	MessageMetricsSubject,
	MessageMetricsSummary,
} from '../../shared/MessageMetricsSummary';

const METRICS_SUBJECTS: MessageMetricsSubject[] = [
	{
		subject: 'ProofOfReport',
		type: SystemMessageType.ProofOfReport,
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
		subject: 'QueryPropagate',
		type: SystemMessageType.QueryPropagate,
	},
	{
		subject: 'QueryMetadataRequest',
		type: SystemMessageType.QueryMetadataRequest,
	},
	{
		subject: 'QueryMetadataResponse',
		type: SystemMessageType.QueryMetadataResponse,
	},
];

export class MessageMetricsCollector {
	private readonly messageMetricsSummary: MessageMetricsSummary;

	constructor(private readonly systemSubscriber: BroadbandSubscriber) {
		this.messageMetricsSummary = new MessageMetricsSummary(METRICS_SUBJECTS);
	}

	public async start() {
		await this.systemSubscriber.subscribe(this.onSystemMessage.bind(this));
	}

	public get summary() {
		return this.messageMetricsSummary.summary;
	}

	public async stop() {
		await this.systemSubscriber.unsubscribe();
	}

	private async onSystemMessage(message: unknown, metadata: MessageMetadata) {
		this.messageMetricsSummary.update(message, metadata);
	}
}
