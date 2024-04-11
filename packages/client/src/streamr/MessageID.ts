import { MessageID } from '@streamr/protocol'

export const messageIdToStr = (messageId: MessageID) => {
  return Buffer.from(`${messageId.streamId}${messageId.streamPartition}${messageId.timestamp}`
    + `${messageId.sequenceNumber}${messageId.publisherId}${messageId.msgChainId}`).toString();
};
