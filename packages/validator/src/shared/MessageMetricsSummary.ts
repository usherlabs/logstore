import { MessageMetadata } from '@logsn/client';
import { SystemMessage, SystemMessageType } from '@logsn/protocol';

import { MessageMetrics } from './MessageMetrics';

export interface MessageMetricsSubject {
	subject: string;
	type: SystemMessageType;
}

export class MessageMetricsSummary {
	private readonly _summary: Map<SystemMessageType, MessageMetrics>;

	constructor(private readonly subjects: MessageMetricsSubject[]) {
		this._summary = new Map<SystemMessageType, MessageMetrics>();

		for (const subject of this.subjects) {
			this._summary.set(subject.type, new MessageMetrics(subject.subject));
		}
	}

	public update(content: unknown, metadata: MessageMetadata) {
		const bytes = (content as string).length;
		const systemMessage = SystemMessage.deserialize(content);

		const metrics = this._summary.get(systemMessage.messageType);
		metrics?.update(metadata.publisherId, systemMessage.seqNum, bytes);
	}

	public get summary() {
		const result = [];

		for (const messageType of this.subjects) {
			result.push(this._summary.get(messageType.type)?.summary);
		}

		return result;
	}
}
