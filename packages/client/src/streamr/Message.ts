import { SignatureType, StreamMessage } from '@streamr/protocol';
import { Message } from '@streamr/sdk';

function signatureTypeToString(signatureType: SignatureType): 'LEGACY_SECP256K1' | 'SECP256K1' | 'ERC_1271' {
	switch (signatureType) {
		case SignatureType.LEGACY_SECP256K1:
			return 'LEGACY_SECP256K1'
		case SignatureType.SECP256K1:
			return 'SECP256K1'
		case SignatureType.ERC_1271:
			return 'ERC_1271'
		default:
			throw new Error(`Unknown signature type: ${signatureType}`);
	}
}

export const convertStreamMessageToMessage = (msg: StreamMessage): Message => {
	return {
		content: msg.getParsedContent(),
		streamId: msg.getStreamId(),
		streamPartition: msg.getStreamPartition(),
		timestamp: msg.getTimestamp(),
		sequenceNumber: msg.getSequenceNumber(),
		signature: msg.signature,
		signatureType: signatureTypeToString(msg.signatureType),
		publisherId: msg.getPublisherId(),
		msgChainId: msg.getMsgChainId(),
		groupKeyId: msg.groupKeyId,
		// @ts-expect-error streamMessage is marked as internal in Message interface
		streamMessage: msg,
		// TODO add other relevant fields (could update some test assertions to
		// use those keys instead of getting the fields via from streamMessage property)
	};
};
