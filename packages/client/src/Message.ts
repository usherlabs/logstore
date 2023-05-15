import { Message } from '@concertodao/streamr-client';
import { StreamMessage } from '@streamr/protocol';

export const convertStreamMessageToMessage = (msg: StreamMessage): Message => {
	return {
		content: msg.getParsedContent(),
		streamId: msg.getStreamId(),
		streamPartition: msg.getStreamPartition(),
		timestamp: msg.getTimestamp(),
		sequenceNumber: msg.getSequenceNumber(),
		signature: msg.signature,
		publisherId: msg.getPublisherId(),
		msgChainId: msg.getMsgChainId(),
	};
};
