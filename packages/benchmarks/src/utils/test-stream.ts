import type { Stream, StreamMetadata, StreamrClient } from '@streamr/sdk';
import crypto from 'crypto';

// using relative otherwise won't work without messing with exports from client
import { counterId } from '../../../client/src/utils/utils';

export const uid = (prefix?: string): string =>
	counterId(`p${process.pid}${prefix ? '-' + prefix : ''}`);

const randomTestRunId =
	process.pid != null ? process.pid : crypto.randomBytes(4).toString('hex');

export const createTestPath = (uniqueId: string, suffix?: string): string => {
	return counterId(
		`/test/${randomTestRunId}/${uniqueId}${suffix !== undefined ? '-' + suffix : ''
		}`,
		'-'
	);
};

/**
 * This one is different from the found on @logsn/client because module doesn't work well with vite
 */
export const createTestStream = async (
	streamrClient: StreamrClient,
	uniqueId: string,
	props?: Partial<StreamMetadata>
): Promise<Stream> => {
	const stream = await streamrClient.createStream({
		id: createTestPath(uniqueId),
		...props,
	});
	return stream;
};
