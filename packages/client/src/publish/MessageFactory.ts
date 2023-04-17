import {
	createSignaturePayload,
	StreamMessage,
	StreamMessageOptions,
} from '@streamr/protocol';

import { Authentication } from '../Authentication';

export const createSignedMessage = async <T>(
	opts: Omit<StreamMessageOptions<T>, 'signature' | 'content'> & {
		serializedContent: string;
		authentication: Authentication;
	}
): Promise<StreamMessage<T>> => {
	const signature = await opts.authentication.createMessageSignature(
		createSignaturePayload({
			messageId: opts.messageId,
			serializedContent: opts.serializedContent,
			prevMsgRef: opts.prevMsgRef ?? undefined,
			newGroupKey: opts.newGroupKey ?? undefined,
		})
	);
	return new StreamMessage<T>({
		...opts,
		signature,
		content: opts.serializedContent,
	});
};
