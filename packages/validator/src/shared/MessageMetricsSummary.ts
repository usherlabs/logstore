import { MessageMetadata } from '@logsn/client';
import { SystemMessage, SystemMessageType } from '@logsn/protocol';

import { MessageMetrics } from './MessageMetrics';

const MESSAGE_TYPES = [
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
	{
		subject: 'RecoveryResponse',
		type: SystemMessageType.RecoveryResponse,
	},
	{
		subject: 'RecoveryComplete',
		type: SystemMessageType.RecoveryComplete,
	},
];

export class MessageMetricsSummary {
	private readonly _summary: Map<SystemMessageType, MessageMetrics>;

	constructor() {
		this._summary = new Map<SystemMessageType, MessageMetrics>();

		for (const messageType of MESSAGE_TYPES) {
			this._summary.set(
				messageType.type,
				new MessageMetrics(messageType.subject)
			);
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

		for (const messageType of MESSAGE_TYPES) {
			result.push(this._summary.get(messageType.type)?.summary);
		}

		return result;
	}
}
